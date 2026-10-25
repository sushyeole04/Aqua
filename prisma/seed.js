const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');

const adapter = new PrismaBetterSqlite3({ url: 'file:dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding clean database for deployment/testing...');

  // Clear existing data in reverse order of dependencies
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.customerReferral.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.delivery.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.adminProfile.deleteMany({});
  await prisma.customerProfile.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Admin
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      phone: '9145565602',
      email: 'admin@chhatrapatiaqua.com',
      name: 'Hub Admin',
      password: adminPassword,
      role: 'ADMIN',
      adminProfile: {
        create: {
          dept: 'Operations'
        }
      }
    }
  });
  console.log('Created Admin:', adminUser.phone);

  // 2. Create Drivers
  const driverPassword = bcrypt.hashSync('password123', 10);
  const driversList = [
    { name: 'Sandeep Patil', phone: '9999000001' },
    { name: 'Vijay Shinde', phone: '9999000002' },
    { name: 'Rahul Kadam', phone: '9999000003' },
    { name: 'Amol Pawar', phone: '9999000004' }
  ];
  for (const d of driversList) {
    await prisma.user.create({
      data: {
        phone: d.phone,
        name: d.name,
        password: driverPassword,
        role: 'DRIVER'
      }
    });
  }
  console.log('Created Drivers');

  // 3. Create Inventory
  const inventoryItem = await prisma.inventory.create({
    data: {
      availableJars: 100,
      returnedJars: 0,
      damagedJars: 0,
      lostJars: 0
    }
  });
  console.log('Created Clean Inventory Stock:', inventoryItem.availableJars);

  console.log('Database cleaned and seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
