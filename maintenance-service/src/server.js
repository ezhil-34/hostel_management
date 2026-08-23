import env from './config/env.js';
import prisma from './config/prisma.js';
import createApp from './app.js';

const app = createApp();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[maintenance-service] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[maintenance-service] health: http://localhost:${env.port}/api/maintenance/health`);
  console.log(`[maintenance-service] core api: ${env.coreApiUrl}`);
});

const shutdown = async (signal) => {
  console.log(`\n[maintenance-service] ${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[maintenance-service] unhandled rejection:', reason);
});
