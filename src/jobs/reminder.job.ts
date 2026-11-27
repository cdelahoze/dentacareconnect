import cron, { ScheduledTask } from 'node-cron';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';

export interface CronRunSummary {
  startedAt: string;
  finishedAt: string;
  lookaheadWindowEnd: string;
  scannedCount: number;
  dispatchedCount: number;
  skippedRecentCount: number;
  failedCount: number;
  details: Array<{
    procedureId: string;
    patientName: string;
    procedureName: string;
    nextControlDate: string;
    outcome: 'DISPATCHED' | 'SKIPPED_COOLDOWN' | 'FAILED';
    channelUsed?: string;
    reason?: string;
  }>;
}

export class ReminderCronJob {
  private static task: ScheduledTask | null = null;
  private static isRunning = false;
  private static lastRunSummary: CronRunSummary | null = null;

  static async executeDailyReminderSweep(customLookaheadDays?: number): Promise<CronRunSummary> {
    if (this.isRunning) {
      throw new Error('Daily reminder sweep is already in progress.');
    }

    this.isRunning = true;
    const startedAt = new Date();
    const lookaheadDays = customLookaheadDays ?? env.REMINDER_LOOKAHEAD_DAYS;

    const windowEnd = new Date(startedAt);
    windowEnd.setDate(windowEnd.getDate() + lookaheadDays);
    windowEnd.setHours(23, 59, 59, 999);

    const cooldownCutoff = new Date(
      startedAt.getTime() - env.REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000
    );

    const summary: CronRunSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: '',
      lookaheadWindowEnd: windowEnd.toISOString(),
      scannedCount: 0,
      dispatchedCount: 0,
      skippedRecentCount: 0,
      failedCount: 0,
      details: [],
    };

    try {
      const dueProcedures = await prisma.patientProcedure.findMany({
        where: {
          status: { in: ['PENDING_FOLLOWUP', 'FOLLOWUP_SCHEDULED'] },
          followUpDueDate: { lte: windowEnd },
        },
        include: {
          patient: true,
          procedure: true,
          appointments: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
          },
          reminders: {
            where: {
              status: { in: ['SENT', 'DELIVERED'] },
              createdAt: { gte: cooldownCutoff },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { followUpDueDate: 'asc' },
      });

      summary.scannedCount = dueProcedures.length;

      for (const procedure of dueProcedures) {
        const patientFullName = `${procedure.patient.firstName} ${procedure.patient.lastName}`;

        if (procedure.appointments && procedure.appointments.length > 0) {
          summary.skippedRecentCount++;
          summary.details.push({
            procedureId: procedure.id,
            patientName: patientFullName,
            procedureName: procedure.procedure.name,
            nextControlDate: procedure.followUpDueDate.toISOString(),
            outcome: 'SKIPPED_COOLDOWN',
            reason: 'Patient already has an active scheduled/confirmed appointment.',
          });
          continue;
        }

        if (procedure.reminders && procedure.reminders.length > 0) {
          summary.skippedRecentCount++;
          summary.details.push({
            procedureId: procedure.id,
            patientName: patientFullName,
            procedureName: procedure.procedure.name,
            nextControlDate: procedure.followUpDueDate.toISOString(),
            outcome: 'SKIPPED_COOLDOWN',
            reason: `Reminder already sent within the last ${env.REMINDER_COOLDOWN_HOURS} hours.`,
          });
          continue;
        }

        try {
          const dispatchResult = await NotificationDispatcherService.dispatchWithFailover({
            procedureId: procedure.id,
          });

          summary.dispatchedCount++;
          summary.details.push({
            procedureId: procedure.id,
            patientName: patientFullName,
            procedureName: procedure.procedure.name,
            nextControlDate: procedure.followUpDueDate.toISOString(),
            outcome: 'DISPATCHED',
            channelUsed: dispatchResult.finalChannelUsed,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown dispatch failure';
          summary.failedCount++;
          summary.details.push({
            procedureId: procedure.id,
            patientName: patientFullName,
            procedureName: procedure.procedure.name,
            nextControlDate: procedure.followUpDueDate.toISOString(),
            outcome: 'FAILED',
            reason: errorMsg,
          });
        }
      }

      summary.finishedAt = new Date().toISOString();
      this.lastRunSummary = summary;

      console.log(
        `[CRON] Daily reminder sweep finished | Scanned: ${summary.scannedCount} | ` +
          `Dispatched: ${summary.dispatchedCount} | Skipped: ${summary.skippedRecentCount} | Failed: ${summary.failedCount}`
      );

      return summary;
    } finally {
      this.isRunning = false;
    }
  }

  static start(): void {
    if (this.task) return;

    if (!cron.validate(env.REMINDER_CRON_SCHEDULE)) {
      console.error(
        `[CRON] Invalid REMINDER_CRON_SCHEDULE expression: "${env.REMINDER_CRON_SCHEDULE}". Cron job not started.`
      );
      return;
    }

    this.task = cron.schedule(
      env.REMINDER_CRON_SCHEDULE,
      async () => {
        console.log(`[CRON] Triggering scheduled daily clinical reminder sweep (${new Date().toISOString()})...`);
        try {
          await this.executeDailyReminderSweep();
        } catch (error) {
          console.error('[CRON] Scheduled sweep encountered an error:', error);
        }
      },
      {
        timezone: env.REMINDER_TIMEZONE,
      }
    );

    console.log(
      `[CRON] Automated Daily Reminder Job registered | Schedule: "${env.REMINDER_CRON_SCHEDULE}" (${env.REMINDER_TIMEZONE})`
    );
  }

  static stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[CRON] Automated Daily Reminder Job stopped.');
    }
  }

  static getStatus() {
    return {
      active: Boolean(this.task),
      isCurrentlyRunning: this.isRunning,
      schedule: env.REMINDER_CRON_SCHEDULE,
      timezone: env.REMINDER_TIMEZONE,
      lookaheadDays: env.REMINDER_LOOKAHEAD_DAYS,
      cooldownHours: env.REMINDER_COOLDOWN_HOURS,
      lastRun: this.lastRunSummary,
    };
  }
}