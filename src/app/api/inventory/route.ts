import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT, getJwtSecret } from '@/utils/auth';

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('aqua_token')?.value;
  if (!token) return null;
  const decoded = await verifyJWT(token, getJwtSecret());
  if (decoded && decoded.role === 'ADMIN') return decoded;
  return null;
}

export async function GET() {
  try {
    let inventory = await prisma.inventory.findFirst();
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          availableJars: 120,
          returnedJars: 450,
          damagedJars: 12,
          lostJars: 5
        }
      });
    }
    return NextResponse.json({ inventory });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await checkAdminAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { availableJars, returnedJars, damagedJars, lostJars } = await request.json();

    let inventory = await prisma.inventory.findFirst();
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          availableJars: Number(availableJars) || 0,
          returnedJars: Number(returnedJars) || 0,
          damagedJars: Number(damagedJars) || 0,
          lostJars: Number(lostJars) || 0
        }
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          availableJars: availableJars !== undefined ? Number(availableJars) : undefined,
          returnedJars: returnedJars !== undefined ? Number(returnedJars) : undefined,
          damagedJars: damagedJars !== undefined ? Number(damagedJars) : undefined,
          lostJars: lostJars !== undefined ? Number(lostJars) : undefined
        }
      });
    }

    return NextResponse.json({ message: 'Inventory updated successfully', inventory });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
