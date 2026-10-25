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

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let targetCustomerId = searchParams.get('customerId');

    // If customer, they can only view their own ledger
    let profile;
    if (auth.role === 'CUSTOMER') {
      profile = await prisma.customerProfile.findUnique({
        where: { userId: auth.userId }
      });
      if (!profile) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }
      targetCustomerId = profile.id;
    } else {
      // Admin request
      if (!targetCustomerId) {
        return NextResponse.json({ error: 'customerId query parameter is required for admin' }, { status: 400 });
      }
      profile = await prisma.customerProfile.findUnique({
        where: { id: targetCustomerId }
      });
      if (!profile) {
        return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      }
    }

    // Fetch payments (credits) and PAY_LATER orders (debits)
    const payments = await prisma.payment.findMany({
      where: {
        customerId: targetCustomerId,
        status: 'PAID'
      },
      orderBy: { createdAt: 'asc' }
    });

    const debits = await prisma.order.findMany({
      where: {
        customerId: targetCustomerId,
        paymentMethod: 'PAY_LATER',
        status: { not: 'CANCELLED' }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Construct ledger entries
    interface LedgerEntry {
      id: string;
      date: string;
      description: string;
      type: 'DEBIT' | 'CREDIT';
      amount: number;
      createdAt: Date;
    }

    const entries: LedgerEntry[] = [];

    // Add credits
    payments.forEach(p => {
      entries.push({
        id: p.id,
        date: new Date(p.paidAt || p.createdAt).toISOString().split('T')[0],
        description: `Payment Received (${p.method})${p.txRef ? ` - Ref: ${p.txRef}` : ''}`,
        type: 'CREDIT',
        amount: p.amount,
        createdAt: p.paidAt || p.createdAt
      });
    });

    // Add debits
    debits.forEach(d => {
      entries.push({
        id: d.id,
        date: new Date(d.createdAt).toISOString().split('T')[0],
        description: `Delivery of ${d.quantity} Jars (Pay Later) - Order #${d.id}`,
        type: 'DEBIT',
        amount: d.totalAmount,
        createdAt: d.createdAt
      });
    });

    // Sort chronologically
    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Calculate running balance
    let runningBalance = 0;
    const ledger = entries.map(entry => {
      if (entry.type === 'DEBIT') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return {
        ...entry,
        balance: runningBalance
      };
    });

    // Sort descending for UI presentation
    ledger.reverse();

    return NextResponse.json({ ledger });
  } catch (error: any) {
    console.error('Error fetching ledger:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST endpoint to allow paying outstanding dues (adding wallet funds / paying dues)
export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, method, txRef, type } = await request.json(); // type: 'WALLET' or 'DUES'

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const profile = await prisma.customerProfile.findUnique({
      where: { userId: auth.userId }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const valAmount = Number(amount);

    const updatedProfile = await prisma.$transaction(async (tx) => {
      // 1. Create paid Payment record
      const payment = await tx.payment.create({
        data: {
          customerId: profile.id,
          amount: valAmount,
          method: method || 'UPI',
          status: 'PAID',
          txRef,
          paidAt: new Date()
        }
      });

      // 2. Adjust dues or wallet
      if (type === 'DUES') {
        const newDues = Math.max(0, profile.pendingDues - valAmount);
        await tx.customerProfile.update({
          where: { id: profile.id },
          data: {
            pendingDues: newDues
          }
        });

        // Also resolve pending PAY_LATER orders status
        // (Just as a convenience, we don't necessarily have to loop all, but it shows PAID status in database)
        await tx.order.updateMany({
          where: {
            customerId: profile.id,
            paymentMethod: 'PAY_LATER',
            paymentStatus: 'PENDING'
          },
          data: {
            paymentStatus: 'PAID'
          }
        });
      } else {
        // WALLET recharge
        await tx.customerProfile.update({
          where: { id: profile.id },
          data: {
            walletBalance: {
              increment: valAmount
            }
          }
        });
      }

      return payment;
    });

    // Log notifications
    await prisma.notification.create({
      data: {
        userId: auth.userId,
        title: type === 'DUES' ? 'Dues Settled' : 'Wallet Recharged',
        message: `Your payment of ₹${valAmount} was received successfully via ${method || 'UPI'}.`,
        type: 'PAYMENT',
        channels: JSON.stringify(['IN_APP', 'SMS'])
      }
    });

    return NextResponse.json({ message: 'Payment recorded successfully', profile: updatedProfile });
  } catch (error: any) {
    console.error('Error posting payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
