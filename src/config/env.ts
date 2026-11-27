import dotenv from 'dotenv';

dotenv.config();

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
};

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3001',
  ENABLE_CRON: (process.env.ENABLE_CRON ?? 'true').toLowerCase() !== 'false',
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 0 * * *',
  REMINDER_WINDOW_DAYS: parsePositiveInt(process.env.REMINDER_WINDOW_DAYS, 7),
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || undefined,
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || 'resend').toLowerCase(),
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'DentaCare Connect <onboarding@resend.dev>',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',
};
