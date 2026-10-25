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

export async function GET() {
  try {
    const auth = await checkAdminAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      include: {
        customerProfile: {
          include: {
            orders: {
              orderBy: {
                createdAt: 'desc'
              }
            },
            payments: {
              orderBy: {
                createdAt: 'desc'
              }
            },
            jarLedger: true,
            jarTransactions: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        }
      } as any,
      orderBy: { createdAt: 'desc' }
    });

    // Format to match frontend CustomerProfile model
    const formattedCustomers = customers.map((user: any) => {
      const profile = user.customerProfile!;
      return {
        id: profile.id,
        userId: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email || undefined,
        address: profile.address,
        qrCodeId: profile.qrCodeId,
        referralCode: profile.referralCode,
        referredBy: profile.referredBy || undefined,
        walletBalance: profile.walletBalance,
        pendingDues: profile.pendingDues,
        creditLimit: profile.creditLimit,
        loyaltyPoints: profile.loyaltyPoints,
        subStatus: profile.subStatus as 'ACTIVE' | 'CANCELLED',
        subQuantity: profile.subQuantity,
        subSchedule: profile.subSchedule || undefined,
        lastDeliveryDate: profile.lastDeliveryDate || undefined,
        orders: profile.orders || [],
        payments: profile.payments || [],
        jarLedger: profile.jarLedger || null,
        jarTransactions: profile.jarTransactions || []
      };
    });

    return NextResponse.json({ customers: formattedCustomers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT request to allow updating customer settings (credit limit, outstanding balance, wallet balance, subscription status, loyalty points)
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('aqua_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = await verifyJWT(token, JWT_SECRET);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, creditLimit, walletBalance, pendingDues, subStatus, subQuantity, subSchedule, loyaltyPoints } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Customer Profile ID is required' }, { status: 400 });
    }

    // Resolve the customer profile to verify ownership
    const profile = await prisma.customerProfile.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Allow if the user is an ADMIN or if they are the CUSTOMER themselves
    if (decoded.role !== 'ADMIN' && profile.userId !== decoded.userId) {
      return NextResponse.json({ error: 'Unauthorized: Access denied' }, { status: 403 });
    }

    // Prepare data block. Customers are restricted from updating financial details directly.
    const dataToUpdate: any = {};
    if (decoded.role === 'ADMIN') {
      if (creditLimit !== undefined) dataToUpdate.creditLimit = Number(creditLimit);
      if (walletBalance !== undefined) dataToUpdate.walletBalance = Number(walletBalance);
      if (pendingDues !== undefined) dataToUpdate.pendingDues = Number(pendingDues);
      if (loyaltyPoints !== undefined) dataToUpdate.loyaltyPoints = Number(loyaltyPoints);
    } else {
      // CUSTOMER role can update their own loyalty points (e.g. during redemption)
      if (loyaltyPoints !== undefined) dataToUpdate.loyaltyPoints = Number(loyaltyPoints);
    }

    // Both roles can update subscription parameters
    if (subStatus !== undefined) dataToUpdate.subStatus = subStatus;
    if (subQuantity !== undefined) dataToUpdate.subQuantity = Number(subQuantity);
    if (subSchedule !== undefined) dataToUpdate.subSchedule = subSchedule;

    const updatedProfile = await prisma.customerProfile.update({
      where: { id },
      data: dataToUpdate,
      include: {
        user: true
      }
    });

    return NextResponse.json({ message: 'Customer settings updated', profile: updatedProfile });
  } catch (error: any) {
    console.error('Error updating customer profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
