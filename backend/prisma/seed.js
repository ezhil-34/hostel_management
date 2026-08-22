/**
 * Seeds a demo warden and student so you can sign in immediately.
 * Run with: npm run db:seed  (or: docker compose exec backend npm run db:seed)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'Password123';

const students = [
  {
    name: 'John Doe',
    email: 'john@student.edu',
    rollNumber: '21CS104',
    phone: '+91 98765 43210',
    roomNo: 'B-302',
    hostelBlock: 'B',
  },
  {
    name: 'Priya Sharma',
    email: 'priya@student.edu',
    rollNumber: '21EC211',
    phone: '+91 90000 11122',
    roomNo: 'A-118',
    hostelBlock: 'A',
  },
];

const ref = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: 'warden@hostel.edu' },
    update: {},
    create: {
      name: 'Hostel Warden',
      email: 'warden@hostel.edu',
      rollNumber: 'WARDEN-01',
      phone: '+91 90000 00000',
      passwordHash,
      role: 'WARDEN',
    },
  });

  for (const student of students) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: {},
      create: {
        ...student,
        passwordHash,
        role: 'STUDENT',
        wallets: {
          create: [
            { type: 'CANTEEN', balance: 450 },
            { type: 'LAUNDRY', balance: 800 },
          ],
        },
      },
      include: { wallets: true },
    });

    const canteen = user.wallets.find((w) => w.type === 'CANTEEN');
    const laundry = user.wallets.find((w) => w.type === 'LAUNDRY');

    if (canteen && (await prisma.pointTransaction.count({ where: { walletId: canteen.id } })) === 0) {
      await prisma.pointTransaction.createMany({
        data: [
          { walletId: canteen.id, title: 'Evening Coffee & Snacks', points: 40, type: 'DEBIT' },
          { walletId: canteen.id, title: 'Lunch Meal Combo', points: 80, type: 'DEBIT' },
        ],
      });
    }

    if (laundry && (await prisma.pointTransaction.count({ where: { walletId: laundry.id } })) === 0) {
      await prisma.pointTransaction.createMany({
        data: [
          { walletId: laundry.id, title: '5kg Wash & Fold', points: 100, type: 'DEBIT' },
          { walletId: laundry.id, title: 'Shirt & Trousers Ironing', points: 45, type: 'DEBIT' },
        ],
      });
    }

    if ((await prisma.outpass.count({ where: { userId: user.id } })) === 0) {
      await prisma.outpass.create({
        data: {
          reference: ref('OUT'),
          userId: user.id,
          roomNo: user.roomNo ?? 'N/A',
          destination: 'Home / Local Market',
          reason: 'Personal work',
          leaveAt: new Date(Date.now() + 3_600_000),
          returnAt: new Date(Date.now() + 36_000_000),
          status: 'APPROVED',
        },
      });
    }

    if ((await prisma.maintenanceRequest.count({ where: { userId: user.id } })) === 0) {
      await prisma.maintenanceRequest.create({
        data: {
          reference: ref('MNT'),
          userId: user.id,
          roomNo: user.roomNo ?? 'N/A',
          category: 'PLUMBING',
          description: 'Water leak in the attached washroom.',
          status: 'IN_PROGRESS',
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log(`  warden@hostel.edu / ${DEMO_PASSWORD}`);
  console.log(`  john@student.edu  / ${DEMO_PASSWORD}   (roll 21CS104)`);
  console.log(`  priya@student.edu / ${DEMO_PASSWORD}   (roll 21EC211)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
