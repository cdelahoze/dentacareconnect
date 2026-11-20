import app from './app';
import { env } from './config/env';
import {
  startControlEngineScheduler,
  stopControlEngineScheduler,
} from './jobs/controlEngine.job';

const server = app.listen(env.PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 DentaCare Connect Server running on port ${env.PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Allowed Origin: ${env.CLIENT_URL}`);
  console.log(`⏰ Control Engine Cron: ${env.ENABLE_CRON ? env.CRON_SCHEDULE : 'DISABLED'}`);
  console.log(`=================================`);

  startControlEngineScheduler();
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Received ${signal}. Shutting down DentaCare Connect cleanly...`);
  await stopControlEngineScheduler();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
