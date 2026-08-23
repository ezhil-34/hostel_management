/**
 * Seeds a demo warden and student so you can sign in immediately.
 * Run with: npm run db:seed  (or: docker compose exec backend npm run db:seed)
 */
import crypto from 'node:crypto';
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

  const warden = await prisma.user.upsert({
    where: { email: 'warden@hostel.edu' },
    update: { passwordHash, isActive: true },
    create: {
      name: 'Hostel Warden',
      email: 'warden@hostel.edu',
      rollNumber: 'WARDEN-01',
      phone: '+91 90000 00000',
      passwordHash,
      role: 'WARDEN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@hostel.edu' },
    update: { passwordHash, isActive: true },
    create: {
      name: 'System Admin',
      email: 'admin@hostel.edu',
      rollNumber: 'ADMIN-01',
      phone: '+91 90000 00001',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // Two workers so the "another worker already picked this up" path can be
  // tried by hand, not just in tests.
  for (const [name, email, roll, phone] of [
    ['Ravi Kumar', 'worker@hostel.edu', 'WRK-01', '+91 90000 00003'],
    ['Anita Desai', 'worker2@hostel.edu', 'WRK-02', '+91 90000 00004'],
  ]) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isActive: true },
      create: { name, email, rollNumber: roll, phone, passwordHash, role: 'MAINTENANCE_WORKER' },
    });
  }

  const security = await prisma.user.upsert({
    where: { email: 'security@hostel.edu' },
    update: { passwordHash, isActive: true },
    create: {
      name: 'Gate Security',
      email: 'security@hostel.edu',
      rollNumber: 'SEC-01',
      phone: '+91 90000 00002',
      passwordHash,
      role: 'SECURITY',
    },
  });

  for (const student of students) {
    const user = await prisma.user.upsert({
      where: { email: student.email },
      update: { passwordHash, isActive: true },
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

    // John is left with no outpass on purpose, so he can walk the full flow
    // straight away: request → warden approves → gate scans him out and in.
    // (A student may hold only one open pass, so a seeded one would block him.)
    //
    // Priya starts already out and an hour past her return time, which gives
    // the warden's "Overdue" filter something to show on a fresh install.
    if (
      user.email === 'priya@student.edu' &&
      (await prisma.outpass.count({ where: { userId: user.id } })) === 0
    ) {
      await prisma.outpass.create({
        data: {
          reference: ref('OUT'),
          userId: user.id,
          roomNo: user.roomNo ?? 'N/A',
          destination: 'City Center',
          reason: 'Picking up study materials from the city bookstore.',
          leaveAt: new Date(Date.now() - 10_800_000),
          returnAt: new Date(Date.now() - 3_600_000), // an hour overdue
          status: 'ACTIVE',
          reviewerId: warden.id,
          reviewedAt: new Date(Date.now() - 14_400_000),
          exitedAt: new Date(Date.now() - 10_500_000),
          exitLoggedBy: security.id,
          verifyToken: crypto.randomBytes(32).toString('base64url'),
        },
      });
    }

  }

  // One pending request so the warden's Approvals tab is not empty on a fresh
  // install and the review flow can be tried straight away.
  const priya = await prisma.user.findUnique({ where: { email: 'priya@student.edu' } });
  if (priya && (await prisma.profileChangeRequest.count({ where: { userId: priya.id } })) === 0) {
    await prisma.profileChangeRequest.create({
      data: {
        reference: `PCR-${Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase()}`,
        userId: priya.id,
        field: 'roomNo',
        oldValue: priya.roomNo,
        newValue: 'A-204',
        reason: 'The hostel office reallocated me to A-204 after the block maintenance.',
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  admin@hostel.edu    / ${DEMO_PASSWORD}   (admin)`);
  console.log(`  warden@hostel.edu   / ${DEMO_PASSWORD}   (warden — 1 profile request, 1 overdue pass)`);
  console.log(`  security@hostel.edu / ${DEMO_PASSWORD}   (gate guard — scans outpass QR codes)`);
  console.log(`  worker@hostel.edu   / ${DEMO_PASSWORD}   (maintenance worker — repair queue)`);
  console.log(`  worker2@hostel.edu  / ${DEMO_PASSWORD}   (second worker, for the race)`);
  console.log(`  john@student.edu    / ${DEMO_PASSWORD}   (roll 21CS104 — no pass yet, request one)`);
  console.log(`  priya@student.edu   / ${DEMO_PASSWORD}   (roll 21EC211 — currently out, overdue)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
