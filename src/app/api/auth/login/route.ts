import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/utils/db';
import { signJWT } from '@/utils/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'chhatrapati-aqua-super-secret-key-123456';

export async function POST(request: Request) {
  try {
    const { loginId, password } = await request.json(); // loginId can be phone or email

    if (!loginId || !password) {
      return NextResponse.json(
        { error: 'Login ID and password are required' },
        { status: 400 }
      );
    }

    // Find user by phone or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: loginId },
          { email: loginId }
        ]
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Sign token
    const tokenPayload = {
      userId: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone
    };

    const token = await signJWT(tokenPayload, JWT_SECRET);

    // Set cookie
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role
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
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
