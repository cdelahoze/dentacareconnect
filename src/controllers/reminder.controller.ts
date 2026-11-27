import { Request, Response, NextFunction } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { SmsService } from '../services/sms.service';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import { ReminderCronJob } from '../jobs/reminder.job';
import { ApiError } from '../utils/ApiError';

/**
 * POST /api/reminders/whatsapp/send
 * Trigger an immediate personalized WhatsApp reminder for a specific procedure
 */
export const sendWhatsAppReminder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { procedureId, customMessage } = req.body;

    const result = await WhatsAppService.sendProcedureReminder({
      procedureId,
      customMessage,
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp reminder dispatched and logged successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reminders/sms/send
 * Trigger a direct SMS reminder via Twilio SMS Gateway (TSK-302)
 */
export const sendSmsReminder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { procedureId, customMessage } = req.body;

    const result = await SmsService.sendProcedureSmsReminder({
      procedureId,
      customMessage,
      isFallback: false,
    });

    res.status(200).json({
      success: true,
      message: 'SMS reminder dispatched and logged successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reminders/dispatch
 * Smart multi-channel dispatch: Attempts WhatsApp first and automatically falls back to SMS if needed
 */
export const dispatchSmartReminder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { procedureId, customMessage } = req.body;

    const result = await NotificationDispatcherService.dispatchWithFailover({
      procedureId,
      customMessage,
    });

    res.status(200).json({
      success: true,
      message: result.fallbackTriggered
        ? 'Reminder delivered via SMS fallback channel.'
        : 'Reminder delivered via primary WhatsApp channel.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reminders/whatsapp/webhook
 * Twilio StatusCallback webhook to track DELIVERED / READ / FAILED statuses (works for both WhatsApp & SMS)
 */
export const twilioStatusWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { MessageSid, MessageStatus, ErrorMessage } = req.body;

    if (!MessageSid || !MessageStatus) {
      throw new ApiError(400, 'Missing MessageSid or MessageStatus from Twilio webhook payload.');
    }

    await WhatsAppService.handleStatusWebhook(MessageSid, MessageStatus, ErrorMessage);

    res.status(200).send('<Response></Response>');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reminders/whatsapp
 * Retrieve WhatsApp reminder audit logs (?procedureId=&patientId=)
 */
export const getWhatsAppReminderLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const procedureId = req.query.procedureId as string | undefined;
    const patientId = req.query.patientId as string | undefined;

    const logs = await WhatsAppService.getReminderLogs({
      procedureId,
      patientId,
    });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reminders/sms
 * Retrieve SMS reminder audit logs (?procedureId=&patientId=)
 */
export const getSmsReminderLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const procedureId = req.query.procedureId as string | undefined;
    const patientId = req.query.patientId as string | undefined;

    const logs = await SmsService.getSmsLogs({
      procedureId,
      patientId,
    });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/reminders/cron/trigger
 * Manually trigger the daily automated reminder sweep on demand (useful for QA testing & admin overrides)
 */
export const triggerDailyReminderCron = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const lookaheadDays = req.body?.lookaheadDays
      ? Number(req.body.lookaheadDays)
      : undefined;

    const summary = await ReminderCronJob.executeDailyReminderSweep(lookaheadDays);

    res.status(200).json({
      success: true,
      message: 'Automated reminder sweep executed successfully.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reminders/cron/status
 * Inspect cron schedule configuration and last execution report
 */
export const getReminderCronStatus = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success: true,
    data: ReminderCronJob.getStatus(),
  });
};