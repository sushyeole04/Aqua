import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT } from '@/utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'chhatrapati-aqua-super-secret-key-123456';

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('aqua_token')?.value;
  if (!token) return null;
  return await verifyJWT(token, JWT_SECRET);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await checkAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Access token required' }, { status: 401 });
    }

    if (auth.role !== 'ADMIN' && auth.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized: Access denied' }, { status: 403 });
    }

    const { id } = await params;
    
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { status, emptyJarsReturned, damagedJars, lostJars, driverName, rating, feedback } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }
    const validStatuses = ['RECEIVED', 'ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: true
          }
        },
        delivery: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    // Role-based validation
    if (auth.role === 'CUSTOMER') {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: auth.userId }
      });
      if (!customerProfile || order.customerId !== customerProfile.id) {
        return NextResponse.json({ error: 'Unauthorized: You can only update your own orders' }, { status: 403 });
      }
      if (status !== order.status) {
        return NextResponse.json({ error: 'Unauthorized: Customers cannot change order status' }, { status: 403 });
      }
    }

    let resolvedDriverId: string | null | undefined = undefined;

    if (status === 'OUT_FOR_DELIVERY') {
      if (driverName) {
        const driver = await prisma.user.findFirst({
          where: { name: driverName, role: 'DRIVER' }
        });
        if (!driver) {
          return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
        }
        resolvedDriverId = driver.id;
      } else {
        resolvedDriverId = null;
      }
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update Order Status
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          paymentStatus: (status === 'DELIVERED' && order.paymentMethod === 'COD') ? 'PAID' : undefined,
        },
        include: {
          delivery: true
        }
      });

      // 2. Update Delivery details
      await tx.delivery.update({
        where: { orderId: id },
        data: {
          driverId: resolvedDriverId,
          deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
          emptyJarsReturned: emptyJarsReturned !== undefined ? Number(emptyJarsReturned) : undefined,
          damagedJars: damagedJars !== undefined ? Number(damagedJars) : undefined,
          lostJars: lostJars !== undefined ? Number(lostJars) : undefined,
          rating: rating !== undefined ? Number(rating) : undefined,
          feedback: feedback !== undefined ? feedback : undefined,
        }
      });

      // 3. If delivered, record COD payment
      if (status === 'DELIVERED' && order.paymentMethod === 'COD') {
        await tx.payment.create({
          data: {
            customerId: order.customerId,
            orderId: id,
            amount: order.totalAmount,
            method: 'COD',
            status: 'PAID',
            paidAt: new Date()
          }
        });
      }

      // 4. Update Inventory stocks on delivery
      if (status === 'DELIVERED') {
        const currentInventory = await tx.inventory.findFirst();
        const qty = order.quantity;
        const returned = emptyJarsReturned !== undefined ? Number(emptyJarsReturned) : 0;
        const damaged = damagedJars !== undefined ? Number(damagedJars) : 0;
        const lost = lostJars !== undefined ? Number(lostJars) : 0;

        if (currentInventory) {
          await tx.inventory.update({
            where: { id: currentInventory.id },
            data: {
              availableJars: {
                decrement: qty
              },
              returnedJars: {
                increment: returned
              },
              damagedJars: {
                increment: damaged
              },
              lostJars: {
                increment: lost
              }
            }
          });
        }

        // 4.1 Update Customer Jar Ledger & Transactions
        const currentLedger = await tx.customerJarLedger.findUnique({
          where: { customerId: order.customerId }
        });

        const newDelivered = (currentLedger?.deliveredJars || 0) + qty;
        const newCollected = (currentLedger?.collectedJars || 0) + returned;
        const newBalance = newDelivered - newCollected;

        await tx.customerJarLedger.upsert({
          where: { customerId: order.customerId },
          create: {
            customerId: order.customerId,
            deliveredJars: newDelivered,
            collectedJars: newCollected,
            balance: newBalance
          },
          update: {
            deliveredJars: newDelivered,
            collectedJars: newCollected,
            balance: newBalance
          }
        });

        // Create transactions
        await tx.jarTransaction.create({
          data: {
            customerId: order.customerId,
            type: 'DELIVERY',
            quantity: qty,
            remarks: `Order #${id.split('-')[0]} Delivery`
          }
        });

        if (returned > 0) {
          await tx.jarTransaction.create({
            data: {
              customerId: order.customerId,
              type: 'COLLECTION',
              quantity: returned,
              remarks: `Order #${id.split('-')[0]} Collection`
            }
          });
        }

        // Calculate and hold deposit: balance * 200
        const depositAmount = Math.max(0, newBalance * 200);
        await tx.customerProfile.update({
          where: { id: order.customerId },
          data: {
            lastDeliveryDate: new Date().toISOString().split('T')[0],
            securityDeposit: depositAmount
          }
        });

        // 4.2 Automated Outstanding Jars alerts
        if (newBalance >= 5) {
          const isCritical = newBalance >= 10;
          await tx.notification.create({
            data: {
              userId: order.customer.userId,
              title: isCritical ? 'CRITICAL: Return Pending Jars' : 'WARNING: Outstanding Jars',
              message: `You currently have ${newBalance} empty jars pending for return. Please return them on the next delivery.`,
              type: 'ORDER',
              channels: JSON.stringify(['IN_APP', 'WHATSAPP', 'SMS'])
            }
          });
        }
      }

      return updated;
    });

    // Create notifications for the customer regarding order status update
    let notifTitle = 'Order Update';
    let notifMsg = `Your order #${id} status is now ${status}.`;

    if (status === 'ACCEPTED') {
      notifTitle = 'Order Accepted';
      notifMsg = `Your order for ${order.quantity} jars has been accepted and is preparing.`;
    } else if (status === 'OUT_FOR_DELIVERY') {
      notifTitle = 'Out for Delivery';
      notifMsg = driverName 
        ? `Driver ${driverName} is on the way with your ${order.quantity} jars!`
        : `Your order for ${order.quantity} jars is on the way!`;
    } else if (status === 'DELIVERED') {
      notifTitle = 'Order Delivered';
      notifMsg = `Successfully delivered ${order.quantity} jars. returned: ${emptyJarsReturned || 0}`;
    }

    await prisma.notification.create({
      data: {
        userId: order.customer.userId,
        title: notifTitle,
        message: notifMsg,
        type: 'ORDER',
        channels: JSON.stringify(['IN_APP', 'WHATSAPP'])
      }
    });

    const responseMessage = status === 'OUT_FOR_DELIVERY' ? 'Dispatch successful' : 'Order status updated successfully';
    return NextResponse.json({ message: responseMessage, order: updatedOrder });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
