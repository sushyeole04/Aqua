import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/utils/db';
import { signJWT } from '@/utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'chhatrapati-aqua-super-secret-key-123456';

export async function POST(request: Request) {
  try {
    const { name, phone, address, password } = await request.json();

    if (!name || !phone || !address || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Phone number already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Generate unique helper strings
    const nameSlug = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'AQU');
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const qrCodeId = `AQUA-${nameSlug}-${randomId}`;
    const referralCode = `AQUA50${nameSlug}${randomId}`;

    // Create user and profile in transaction
    const newUser = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          phone,
          name,
          password: hashedPassword,
          role: 'CUSTOMER',
          customerProfile: {
            create: {
              qrCodeId,
              referralCode,
              address,
              walletBalance: 0.0,
              pendingDues: 0.0,
              creditLimit: 2000.0,
              loyaltyPoints: 0,
              subStatus: 'CANCELLED'
            }
          }
        },
        include: {
          customerProfile: true
        }
      });
    });

    // Create a welcome notification for this customer
    await prisma.notification.create({
      data: {
        userId: newUser.id,
        title: 'Welcome to Chhatrapati Aqua!',
        message: `Hi ${name}, thank you for registering! You can now place quick water jar orders.`,
        type: 'SYSTEM',
        channels: JSON.stringify(['IN_APP'])
      }
    });

    // Sign JWT token
    const tokenPayload = {
      userId: newUser.id,
      role: newUser.role,
      name: newUser.name,
      phone: newUser.phone
    };

    const token = await signJWT(tokenPayload, JWT_SECRET);

    // Set cookie
    const response = NextResponse.json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        customerProfile: newUser.customerProfile
      }
    });

    response.cookies.set({
      name: 'aqua_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
