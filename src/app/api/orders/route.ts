import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT } from '@/utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'chhatrapati-aqua-super-secret-key-123456';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('aqua_token')?.value;
  if (!token) return null;
  return await verifyJWT(token, JWT_SECRET);
}

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let orders;
    if (auth.role === 'ADMIN') {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true
                }
              }
            }
          },
          delivery: true
        }
      });
    } else {
      // Find customer profile id first
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: auth.userId }
      });

      if (!customerProfile) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }

      orders = await prisma.order.findMany({
        where: { customerId: customerProfile.id },
        orderBy: { createdAt: 'desc' },
        include: {
          delivery: true
        }
      });
    }

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: auth.userId },
      include: {
        user: true
      }
    });

    if (!customerProfile) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { quantity, type, paymentMethod, scheduledDate, notes } = await request.json();

    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    const pricePerJar = 25.0; // Standard price
    const totalAmount = quantity * pricePerJar;

    // Create the order, transaction logic for PAY_LATER or wallet
    const newOrder = await prisma.$transaction(async (tx) => {
      // 1. If paying with PAY_LATER, increment dues
      if (paymentMethod === 'PAY_LATER') {
        await tx.customerProfile.update({
          where: { id: customerProfile.id },
          data: {
            pendingDues: {
              increment: totalAmount
            }
          }
        });
      }

      // 2. Create the order
      const order = await tx.order.create({
        data: {
          customerId: customerProfile.id,
          type: type || 'ONCE',
          quantity,
          status: 'RECEIVED',
          totalAmount,
          paymentMethod,
          paymentStatus: paymentMethod === 'UPI' ? 'PAID' : 'PENDING',
          notes,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
          delivery: {
            create: {} // Create placeholder delivery
          }
        },
        include: {
          delivery: true
        }
      });

      // 3. Create a payment record if paid via UPI
      if (paymentMethod === 'UPI') {
        await tx.payment.create({
          data: {
            customerId: customerProfile.id,
            orderId: order.id,
            amount: totalAmount,
            method: 'UPI',
            status: 'PAID',
            paidAt: new Date()
          }
        });
      }

      // 4. Update loyalty points (+10 per jar)
      await tx.customerProfile.update({
        where: { id: customerProfile.id },
        data: {
          loyaltyPoints: {
            increment: quantity * 10
          }
        }
      });

      return order;
    });

    // Create notifications for both customer and admin
    await prisma.notification.createMany({
      data: [
        {
          userId: auth.userId,
          title: 'Order Confirmed',
          message: `Your order for ${quantity} jars has been received. Total: ₹${totalAmount}.`,
          type: 'ORDER',
          channels: JSON.stringify(['IN_APP', 'WHATSAPP'])
        },
        {
          // Find first admin user
          userId: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id || auth.userId,
          title: 'New Order Received',
          message: `${customerProfile.user.name} ordered ${quantity} jars via ${paymentMethod}.`,
          type: 'ORDER',
          channels: JSON.stringify(['IN_APP', 'PUSH'])
        }
      ]
    });

    return NextResponse.json({ message: 'Order placed successfully', order: newOrder });
  } catch (error: any) {
    console.error('Error placing order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
