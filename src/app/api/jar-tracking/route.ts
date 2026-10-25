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

export async function GET(request: Request) {
  try {
    const auth = await checkAdminAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('filter') || 'ALL'; // 'ALL', 'OVERDUE' (outstanding >= 5), 'HIGHEST'

    // 1. Fetch Inventory KPIs
    let inventory = await prisma.inventory.findFirst();
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: { availableJars: 120, returnedJars: 450, damagedJars: 12, lostJars: 5 }
      });
    }

    // 2. Fetch Customer Jar Ledgers
    const ledgers = await prisma.customerJarLedger.findMany({
      include: {
        customer: {
          include: {
            user: true
          }
        }
      }
    });

    // 3. Compute Aggregated metrics
    const totalJarsInStock = inventory.availableJars + inventory.returnedJars;
    const jarsWithCustomers = ledgers.reduce((acc, l) => acc + l.balance, 0);
    const totalDelivered = ledgers.reduce((acc, l) => acc + l.deliveredJars, 0);
    const totalCollected = ledgers.reduce((acc, l) => acc + l.collectedJars, 0);
    
    // Recovery & Efficiency
    const recoveryRate = totalDelivered > 0 ? (totalCollected / totalDelivered) * 100 : 100;
    const collectionEfficiency = (totalCollected + jarsWithCustomers) > 0 
      ? (totalCollected / (totalCollected + jarsWithCustomers)) * 100 
      : 100;
    const totalJarsInCirculation = totalJarsInStock + jarsWithCustomers + inventory.damagedJars + inventory.lostJars;

    // 4. Filters & Search mapping
    let customersList = ledgers.map(l => ({
      id: l.customer.id,
      name: l.customer.user.name,
      phone: l.customer.user.phone,
      address: l.customer.address,
      delivered: l.deliveredJars,
      collected: l.collectedJars,
      outstanding: l.balance,
      deposit: l.customer.securityDeposit,
    }));

    if (filterType === 'OVERDUE') {
      customersList = customersList.filter(c => c.outstanding >= 5);
    } else if (filterType === 'HIGHEST') {
      customersList.sort((a, b) => b.outstanding - a.outstanding);
    }

    // 5. Weekly Movement Trend (JarTransaction logs)
    const transactions = await prisma.jarTransaction.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    // Group transactions by date for charts
    const chartMap: { [key: string]: { name: string; delivered: number; collected: number } } = {};
    const last7Days = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - idx);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(date => {
      const dayName = new Date(date).toLocaleDateString([], { weekday: 'short' });
      chartMap[date] = { name: dayName, delivered: 0, collected: 0 };
    });

    transactions.forEach(t => {
      const dateStr = t.createdAt.toISOString().split('T')[0];
      if (chartMap[dateStr]) {
        if (t.type === 'DELIVERY') {
          chartMap[dateStr].delivered += t.quantity;
        } else if (t.type === 'COLLECTION') {
          chartMap[dateStr].collected += t.quantity;
        }
      }
    });

    const jarMovementTrend = Object.keys(chartMap).map(k => chartMap[k]);

    // Outstanding Distribution
    const distribution = [
      { name: '0 Jars', count: customersList.filter(c => c.outstanding === 0).length },
      { name: '1-5 Jars', count: customersList.filter(c => c.outstanding >= 1 && c.outstanding <= 5).length },
      { name: '6-9 Jars', count: customersList.filter(c => c.outstanding >= 6 && c.outstanding <= 9).length },
      { name: '10+ Jars', count: customersList.filter(c => c.outstanding >= 10).length }
    ];

    // Customer Wise holdings for top 5
    const customerWiseHoldings = [...customersList]
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5)
      .map(c => ({ name: c.name, jars: c.outstanding }));

    return NextResponse.json({
      stats: {
        totalJarsInStock,
        jarsWithCustomers,
        returnedJars: inventory.returnedJars,
        damagedJars: inventory.damagedJars,
        lostJars: inventory.lostJars,
        circulation: totalJarsInCirculation,
        recoveryRate: Math.round(recoveryRate * 10) / 10,
        collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
      },
      customersList,
      jarMovementTrend,
      outstandingDistribution: distribution,
      customerWiseHoldings
    });
  } catch (error: any) {
    console.error('Error fetching jar tracking details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
