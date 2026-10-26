import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/utils/db';
import { verifyJWT, getJwtSecret } from '@/utils/auth';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('aqua_token')?.value;
  if (!token) return null;
  return await verifyJWT(token, getJwtSecret());
}

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' }
    });

    interface NotificationRecord {
      id: string;
      title: string;
      message: string;
      type: string;
      channels: string;
      isRead: boolean;
      createdAt: Date;
    }

    const formatted = notifications.map((n: NotificationRecord) => {
      let channels: ('SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP')[] = [];
      try {
        const parsed = n.channels ? JSON.parse(n.channels) : [];
        channels = Array.isArray(parsed) ? parsed : [];
      } catch {
        channels = [];
      }

      return {
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type as 'ORDER' | 'PAYMENT' | 'INVENTORY' | 'SYSTEM',
        channels,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString()
      };
    });

    return NextResponse.json({ notifications: formatted });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, markAll } = await request.json();

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: auth.userId, isRead: false },
        data: { isRead: true }
      });
    } else if (id) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      });
    } else {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Notifications marked as read' });
  } catch (error: any) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
