import app from './app';
import { env } from './config/env';
import prisma from './config/prisma';
import {
  startControlEngineScheduler,
  stopControlEngineScheduler,
} from './jobs/controlEngine.job';
import { ReminderCronJob } from './jobs/reminder.job';

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to Neon PostgreSQL database successfully.');

    const server = app.listen(env.PORT, () => {
      console.log(`=================================`);
      console.log(`🚀 DentaCare Connect Server running on port ${env.PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Allowed Origin: ${env.CLIENT_URL}`);
      console.log(`⏰ Control Engine Cron: ${env.ENABLE_CRON ? env.CRON_SCHEDULE : 'DISABLED'}`);
      console.log(`=================================`);

      startControlEngineScheduler();
      ReminderCronJob.start();
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n🛑 Received ${signal}. Shutting down DentaCare Connect cleanly...`);
      await stopControlEngineScheduler();
      ReminderCronJob.stop();
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();