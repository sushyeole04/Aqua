import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT } from '@/utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'chhatrapati-aqua-super-secret-key-123456';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('aqua_token')?.value;
  if (!token) return null;
  const decoded = await verifyJWT(token, JWT_SECRET);
  if (decoded && decoded.role === 'ADMIN') return decoded;
  return null;
}

export async function POST(request: Request) {
  try {
    const auth = await checkAdminAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { customerId, action, amount, jars } = await request.json();

    if (!customerId || !action || amount === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { id: customerId },
      include: { jarLedger: true }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let finalDeposit = customer.securityDeposit;

      if (action === 'CHARGE') {
        finalDeposit += Number(amount);
      } else if (action === 'REFUND') {
        finalDeposit = Math.max(0, finalDeposit - Number(amount));
      } else if (action === 'ADJUST_LOST') {
        // Reduce deposit hold
        finalDeposit = Math.max(0, finalDeposit - Number(amount));

        // Adjust jar counts: reduce outstanding jar balance
        const numJars = Number(jars) || 0;
        if (numJars > 0 && customer.jarLedger) {
          const newDelivered = Math.max(0, customer.jarLedger.deliveredJars - numJars);
          const newBalance = Math.max(0, customer.jarLedger.balance - numJars);

          await tx.customerJarLedger.update({
            where: { customerId },
            data: {
              deliveredJars: newDelivered,
              balance: newBalance
            }
          });

          // Increment inventory lost count
          const inv = await tx.inventory.findFirst();
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                lostJars: {
                  increment: numJars
                }
              }
            });
          }

          // Create transaction logs
          await tx.jarTransaction.create({
            data: {
              customerId,
              type: 'COLLECTION',
              quantity: numJars,
              remarks: `Lost jars adjustment write-off: ${numJars} jars`
            }
          });
        }
      }

      // Update customer profile security deposit hold
      const updatedProfile = await tx.customerProfile.update({
        where: { id: customerId },
        data: {
          securityDeposit: finalDeposit
        },
        include: {
          jarLedger: true,
          user: true
        }
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'DEPOSIT_ADJUSTMENT',
          details: `Action: ${action}, Customer: ${customer.id}, Amount: ₹${amount}, Jars: ${jars || 0}`
        }
      });

      return updatedProfile;
    });

    return NextResponse.json({ message: 'Security deposit adjusted successfully', customer: updated });
  } catch (error: any) {
    console.error('Error adjusting security deposit:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
