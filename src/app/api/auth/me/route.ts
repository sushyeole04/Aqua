import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT, getJwtSecret } from '@/utils/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('aqua_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decoded = await verifyJWT(token, getJwtSecret());
    if (!decoded) {
      const response = NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
      response.cookies.delete('aqua_token');
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        customerProfile: {
          include: {
            jarLedger: true,
            jarTransactions: {
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        },
        adminProfile: true
      }
    });

    if (!user) {
      const response = NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
      response.cookies.delete('aqua_token');
      return response;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        customerProfile: user.customerProfile,
        adminProfile: user.adminProfile
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
