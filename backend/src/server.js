import env from './config/env.js';
import prisma from './config/prisma.js';
import createApp from './app.js';

const app = createApp();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[hostel-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[hostel-api] health: http://localhost:${env.port}/api/health`);
});

const shutdown = async (signal) => {
  console.log(`\n[hostel-api] ${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Do not hang forever if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[hostel-api] unhandled rejection:', reason);
});
