import { Router } from 'express';
import {
  sendWhatsAppReminder,
  sendSmsReminder,
  dispatchSmartReminder,
  triggerDailyReminderCron,
  getReminderCronStatus,
  twilioStatusWebhook,
  getWhatsAppReminderLogs,
  getSmsReminderLogs,
} from '../controllers/reminder.controller';
import {
  dispatchReminderValidator,
  listRemindersQueryValidator,
} from '../validators/reminder.validator';
import { validateRequest } from '../middlewares/validate.middleware';

const router = Router();

// POST /api/reminders/whatsapp/send - Dispatch personalized WhatsApp reminder
router.post('/whatsapp/send', dispatchReminderValidator, validateRequest, sendWhatsAppReminder);

// POST /api/reminders/sms/send - Dispatch direct SMS reminder (TSK-302)
router.post('/sms/send', dispatchReminderValidator, validateRequest, sendSmsReminder);

// POST /api/reminders/dispatch - Smart dispatch with automatic WhatsApp -> SMS failover
router.post('/dispatch', dispatchReminderValidator, validateRequest, dispatchSmartReminder);

// POST /api/reminders/cron/trigger - Manually run the daily reminder sweep (TSK-303)
router.post('/cron/trigger', triggerDailyReminderCron);

// GET /api/reminders/cron/status - Check cron job schedule & last run summary (TSK-303)
router.get('/cron/status', getReminderCronStatus);


// POST /api/reminders/whatsapp/webhook - Receive delivery status updates from Twilio (WhatsApp & SMS)
router.post('/whatsapp/webhook', twilioStatusWebhook);
router.post('/sms/webhook', twilioStatusWebhook);

// GET /api/reminders/whatsapp - List WhatsApp reminder audit logs
router.get('/whatsapp', listRemindersQueryValidator, validateRequest, getWhatsAppReminderLogs);

// GET /api/reminders/sms - List SMS reminder audit logs
router.get('/sms', listRemindersQueryValidator, validateRequest, getSmsReminderLogs);

export default router;
