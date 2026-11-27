import crypto from 'crypto';
import { Prisma, ReminderStatus, TreatmentStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import {
  ControlEngineRunOptions,
  ControlEngineRunResult,
  DailyQueueResponse,
  dueProcedureInclude,
  DueProcedureRecord,
  FollowUpQueueEntry,
  QueueQueryFilters,
  reminderQueueInclude,
} from '../types/controlEngine.types';
import { EmailDispatchBatchResult, EmailDispatchOptions } from '../types/email.types';
import { EmailDispatchService } from './emailDispatch.service';
import {
  addDays,
  buildBookingUrl,
  buildQueueEntryFromProcedure,
  buildQueueEntryFromReminder,
  buildReminderMessage,
  classifyUrgency,
  createEmptyChannelCounts,
  createEmptyUrgencyCounts,
  getEndOfDay,
  getStartOfDay,
  hasActiveOrCurrentCycleReminder,
} from '../utils/controlEngine.helpers';

const ELIGIBLE_TREATMENT_STATUSES: TreatmentStatus[] = [
  TreatmentStatus.PENDING_FOLLOWUP,
  TreatmentStatus.OVERDUE,
];

export class ControlEngineService {
  /**
   * TSK-205: Safely and idempotently transition past-due PENDING_FOLLOWUP procedures to OVERDUE.
   */
  static async transitionOverdueProcedures(referenceDate: Date = new Date()): Promise<number> {
    const startOfToday = getStartOfDay(referenceDate);

    const updateResult = await prisma.patientProcedure.updateMany({
      where: {
        status: TreatmentStatus.PENDING_FOLLOWUP,
        followUpDueDate: {
          lt: startOfToday,
        },
      },
      data: {
        status: TreatmentStatus.OVERDUE,
      },
    });

    return updateResult.count;
  }

  /**
   * TSK-205: Query eligible PatientProcedure records due on or before the configured reminder window.
   */
  static async findDuePatientProcedures(
    referenceDate: Date = new Date(),
    windowDays: number = env.REMINDER_WINDOW_DAYS
  ): Promise<DueProcedureRecord[]> {
    const windowEnd = getEndOfDay(addDays(referenceDate, windowDays));

    return prisma.patientProcedure.findMany({
      where: {
        status: {
          in: ELIGIBLE_TREATMENT_STATUSES,
        },
        followUpDueDate: {
          lte: windowEnd,
        },
        patient: {
          isActive: true,
        },
      },
      include: dueProcedureInclude,
      orderBy: {
        followUpDueDate: 'asc',
      },
    });
  }

  /**
   * TSK-206: Build structured follow-up queue entries and idempotently persist PENDING reminders.
   */
  static async generateFollowUpQueue(
    dueProcedures: DueProcedureRecord[],
    referenceDate: Date = new Date(),
    dryRun = false
  ): Promise<{ queue: FollowUpQueueEntry[]; skippedExistingReminders: number }> {
    const startOfToday = getStartOfDay(referenceDate);
    const endOfToday = getEndOfDay(referenceDate);

    const queue: FollowUpQueueEntry[] = [];
    let skippedExistingReminders = 0;

    for (const record of dueProcedures) {
      if (hasActiveOrCurrentCycleReminder(record.reminders, startOfToday, endOfToday)) {
        skippedExistingReminders += 1;
        continue;
      }

      const urgency = classifyUrgency(record.followUpDueDate, referenceDate, record.status);
      const bookingToken = crypto.randomUUID();
      const bookingUrl = buildBookingUrl(bookingToken);
      const messageContent = buildReminderMessage(
        record.patient.firstName,
        record.procedure.name,
        urgency,
        bookingUrl
      );

      let reminderId: string | null = null;
      let reminderStatus: ReminderStatus = ReminderStatus.PENDING;
      let scheduledFor = referenceDate;

      if (!dryRun) {
        const createdReminder = await prisma.reminder.create({
          data: {
            patientId: record.patient.id,
            patientProcedureId: record.id,
            channel: record.patient.preferredChannel,
            status: ReminderStatus.PENDING,
            scheduledFor: referenceDate,
            bookingToken,
            bookingUrl,
            messageContent,
          },
        });

        reminderId = createdReminder.id;
        reminderStatus = createdReminder.status;
        scheduledFor = createdReminder.scheduledFor;
      }

      queue.push(
        buildQueueEntryFromProcedure({
          record,
          reminderId,
          reminderStatus,
          scheduledFor,
          urgency,
          bookingToken,
          bookingUrl,
          messageContent,
        })
      );
    }

    return { queue, skippedExistingReminders };
  }

  /**
   * Execute the full daily control engine pipeline (TSK-205 + TSK-206).
   */
  static async runDailyControlEngine(
    options: ControlEngineRunOptions = {}
  ): Promise<ControlEngineRunResult> {
    const startTimeMs = Date.now();
    const runId = crypto.randomUUID();
    const startedAt = new Date(startTimeMs);
    const referenceDate = options.referenceDate ?? startedAt;
    const windowDays = options.windowDays ?? env.REMINDER_WINDOW_DAYS;
    const dryRun = options.dryRun ?? false;

    const transitionedToOverdue = dryRun
      ? await prisma.patientProcedure.count({
          where: {
            status: TreatmentStatus.PENDING_FOLLOWUP,
            followUpDueDate: { lt: getStartOfDay(referenceDate) },
          },
        })
      : await this.transitionOverdueProcedures(referenceDate);

    const dueProcedures = await this.findDuePatientProcedures(referenceDate, windowDays);
    const { queue, skippedExistingReminders } = await this.generateFollowUpQueue(
      dueProcedures,
      referenceDate,
      dryRun
    );

    const byUrgency = createEmptyUrgencyCounts();
    const byChannel = createEmptyChannelCounts();

    for (const entry of queue) {
      byUrgency[entry.urgency] += 1;
      byChannel[entry.channel] += 1;
    }

    const emailDispatch = await this.dispatchPendingEmailReminders({
      referenceDate,
      dryRun,
    });

    const completedAt = new Date();
    const durationMs = Date.now() - startTimeMs;

    return {
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      referenceDate: referenceDate.toISOString(),
      windowDays,
      dryRun,
      summary: {
        transitionedToOverdue,
        eligibleDueProcedures: dueProcedures.length,
        newlyQueuedReminders: queue.length,
        skippedExistingReminders,
        byUrgency,
        byChannel,
      },
      queue,
      emailDispatch,
    };
  }

  /**
   * TSK-306: Dispatch pending EMAIL channel reminders via EmailDispatchService.
   */
  static async dispatchPendingEmailReminders(
    options: EmailDispatchOptions = {}
  ): Promise<EmailDispatchBatchResult> {
    return EmailDispatchService.dispatchPendingEmailReminders(options);
  }

  /**
   * Inspect today's (or a specified date's) generated follow-up reminder queue.
   */
  static async getDailyFollowUpQueue(
    filters: QueueQueryFilters = {}
  ): Promise<DailyQueueResponse> {
    const targetDate = filters.date ?? new Date();
    const startOfTargetDay = getStartOfDay(targetDate);
    const endOfTargetDay = getEndOfDay(targetDate);

    const where: Prisma.ReminderWhereInput = {
      status: ReminderStatus.PENDING,
      patientProcedureId: { not: null },
      scheduledFor: {
        gte: startOfTargetDay,
        lte: endOfTargetDay,
      },
      ...(filters.channel ? { channel: filters.channel } : {}),
    };

    const reminders = await prisma.reminder.findMany({
      where,
      include: reminderQueueInclude,
      orderBy: [
        { patientProcedure: { followUpDueDate: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    const byUrgency = createEmptyUrgencyCounts();
    const byChannel = createEmptyChannelCounts();
    const queue: FollowUpQueueEntry[] = [];

    for (const reminder of reminders) {
      if (!reminder.patientProcedure) continue;

      const urgency = classifyUrgency(
        reminder.patientProcedure.followUpDueDate,
        targetDate,
        reminder.patientProcedure.status
      );

      if (filters.urgency && urgency !== filters.urgency) {
        continue;
      }

      const entry = buildQueueEntryFromReminder(reminder, urgency);
      if (!entry) continue;

      byUrgency[urgency] += 1;
      byChannel[reminder.channel] += 1;
      queue.push(entry);
    }

    return {
      date: startOfTargetDay.toISOString().split('T')[0],
      total: queue.length,
      byUrgency,
      byChannel,
      queue,
    };
  }
}
