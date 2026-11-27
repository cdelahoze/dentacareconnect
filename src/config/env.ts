import dotenv from 'dotenv';

dotenv.config();

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  ENABLE_CRON: parseBoolean(process.env.ENABLE_CRON, true),
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 0 * * *',
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || '',
  REMINDER_WINDOW_DAYS: parsePositiveInt(process.env.REMINDER_WINDOW_DAYS, 3),
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
  TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM || '',
  REMINDER_CRON_SCHEDULE: process.env.REMINDER_CRON_SCHEDULE || '0 8 * * *',
  REMINDER_TIMEZONE: process.env.REMINDER_TIMEZONE || 'America/Bogota',
  REMINDER_LOOKAHEAD_DAYS: Number(process.env.REMINDER_LOOKAHEAD_DAYS) || 3,
  REMINDER_COOLDOWN_HOURS: Number(process.env.REMINDER_COOLDOWN_HOURS) || 24,
};
