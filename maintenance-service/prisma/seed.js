/**
 * Seeds a few open jobs so the worker queue is not empty on a fresh install.
 *
 * Note what this CANNOT do: create users. They live in the core API's database,
 * which this service has no connection to. So the reporter id comes from an
 * environment variable — take a real student uuid from the core API if you want
 * the student side populated too. Otherwise these belong to a placeholder that
 * nobody can sign in as, which is fine for trying the worker queue.
 *
 * Run with: docker compose exec maintenance-service npm run db:seed
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const ref = () => `MNT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

const DEMO_STUDENT_ID = process.env.SEED_STUDENT_ID ?? '00000000-0000-4000-8000-000000000001';

const requests = [
  {
    reporterName: 'John Doe',
    reporterRollNumber: '21CS104',
    reporterPhone: '+91 98765 43210',
    roomNo: 'B-302',
    locationDetail: 'Attached washroom',
    category: 'PLUMBING',
    priority: 'URGENT',
    title: 'Washroom tap will not stop running',
    description:
      'The cold tap in the attached washroom has been running continuously since yesterday evening. The washer looks worn and it cannot be turned off fully.',
  },
  {
    reporterName: 'Priya Sharma',
    reporterRollNumber: '21EC211',
    reporterPhone: '+91 90000 11122',
    roomNo: 'A-118',
    locationDetail: 'Ceiling fan',
    category: 'ELECTRICAL',
    priority: 'HIGH',
    title: 'Ceiling fan making a grinding noise',
    description:
      'The ceiling fan has started making a loud grinding noise on speeds three and above, and it wobbles noticeably. It seems unsafe to keep using.',
  },
  {
    reporterName: 'John Doe',
    reporterRollNumber: '21CS104',
    reporterPhone: '+91 98765 43210',
    roomNo: 'B-302',
    locationDetail: 'Study desk drawer',
    category: 'CARPENTRY',
    priority: 'LOW',
    title: 'Desk drawer runner has come off',
    description:
      'The bottom drawer of the study desk has come off its runner and will not slide back in properly. The drawer front is also slightly loose.',
  },
];

async function main() {
  const existing = await prisma.maintenanceRequest.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} request(s) already present.`);
    return;
  }

  for (const request of requests) {
    const created = await prisma.maintenanceRequest.create({
      data: { ...request, reference: ref(), studentId: DEMO_STUDENT_ID },
    });
    await prisma.maintenanceEvent.create({
      data: {
        requestId: created.id,
        type: 'REPORTED',
        actorId: DEMO_STUDENT_ID,
        actorName: request.reporterName,
      },
    });
  }

  console.log(`Seed complete — ${requests.length} jobs waiting in the queue.`);
  console.log('  Sign in as worker@hostel.edu to pick one up.');
  console.log('  They belong to a placeholder student; report one through the UI');
  console.log('  to see the student side of the flow.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
