import { NotificationChannel, Prisma, ReminderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { buildFollowUpReminderEmail } from '../templates/followUpReminder.template';
import { reminderQueueInclude } from '../types/controlEngine.types';
import {
  EmailDispatchBatchResult,
  EmailDispatchItemResult,
  EmailDispatchOptions,
} from '../types/email.types';
import { classifyUrgency, getEndOfDay } from '../utils/controlEngine.helpers';
import { EmailService } from './email.service';

export class EmailDispatchService {
  /**
   * Dispatch all PENDING EMAIL reminders due on or before the reference date.
   * Updates each Reminder record atomically and isolates per-item failures.
   */
  static async dispatchPendingEmailReminders(
    options: EmailDispatchOptions = {}
  ): Promise<EmailDispatchBatchResult> {
    const startTimeMs = Date.now();
    const startedAt = new Date(startTimeMs).toISOString();
    const referenceDate = options.referenceDate ?? new Date();
    const dryRun = options.dryRun ?? false;
    const provider = EmailService.resolveActiveProvider();

    const where: Prisma.ReminderWhereInput = {
      channel: NotificationChannel.EMAIL,
      status: ReminderStatus.PENDING,
      scheduledFor: {
        lte: getEndOfDay(referenceDate),
      },
      patient: {
        isActive: true,
      },
    };

    const pendingReminders = await prisma.reminder.findMany({
      where,
      include: reminderQueueInclude,
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      ...(options.limit && options.limit > 0 ? { take: options.limit } : {}),
    });

    const results: EmailDispatchItemResult[] = [];
    let sentCount = 0;
    let failedCount = 0;
    let escalatedCount = 0;

    for (const reminder of pendingReminders) {
      const patientName = `${reminder.patient.firstName} ${reminder.patient.lastName}`.trim();
      const procedureName = reminder.patientProcedure?.procedure.name ?? 'Dental Follow-Up';
      const followUpDueDate =
        reminder.patientProcedure?.followUpDueDate ?? reminder.scheduledFor;
      const urgency = reminder.patientProcedure
        ? classifyUrgency(
            reminder.patientProcedure.followUpDueDate,
            referenceDate,
            reminder.patientProcedure.status
          )
        : 'UPCOMING';

      if (dryRun) {
        results.push({
          reminderId: reminder.id,
          patientId: reminder.patientId,
          recipientEmail: reminder.patient.email,
          status: 'SKIPPED_DRY_RUN',
          provider,
          providerMessageId: null,
          retryCount: reminder.retryCount,
          isEscalated: reminder.isEscalated,
        });
        continue;
      }

      try {
        const emailContent = buildFollowUpReminderEmail({
          patientName,
          procedureName,
          followUpDueDate,
          urgency,
          bookingToken: reminder.bookingToken,
        });

        const delivery = await EmailService.sendEmail({
          to: reminder.patient.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          tags: [
            { name: 'reminderId', value: reminder.id },
            { name: 'urgency', value: urgency },
          ],
        });

        if (delivery.status === 'SENT') {
          await prisma.$transaction(async (tx) => {
            await tx.reminder.update({
              where: { id: reminder.id },
              data: {
                status: ReminderStatus.SENT,
                sentAt: delivery.sentAt ?? new Date(),
              },
            });
          });

          sentCount += 1;
          results.push({
            reminderId: reminder.id,
            patientId: reminder.patientId,
            recipientEmail: reminder.patient.email,
            status: 'SENT',
            provider: delivery.provider,
            providerMessageId: delivery.messageId,
            retryCount: reminder.retryCount,
            isEscalated: reminder.isEscalated,
          });
        } else {
          const nextRetryCount = reminder.retryCount + 1;
          const reachedMaxRetries = nextRetryCount >= reminder.maxRetries;
          const failureNote = `[${new Date().toISOString()}] Email dispatch failed (attempt ${nextRetryCount}/${reminder.maxRetries}): ${delivery.error ?? 'Unknown delivery error'}`;

          await prisma.$transaction(async (tx) => {
            await tx.reminder.update({
              where: { id: reminder.id },
              data: {
                status: ReminderStatus.FAILED,
                retryCount: nextRetryCount,
                isEscalated: reachedMaxRetries,
                escalatedAt: reachedMaxRetries ? new Date() : reminder.escalatedAt,
                escalationNotes: failureNote,
              },
            });
          });

          failedCount += 1;
          if (reachedMaxRetries) {
            escalatedCount += 1;
          }

          results.push({
            reminderId: reminder.id,
            patientId: reminder.patientId,
            recipientEmail: reminder.patient.email,
            status: 'FAILED',
            provider: delivery.provider,
            providerMessageId: null,
            retryCount: nextRetryCount,
            isEscalated: reachedMaxRetries,
            error: delivery.error,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unexpected dispatch error';
        const nextRetryCount = reminder.retryCount + 1;
        const reachedMaxRetries = nextRetryCount >= reminder.maxRetries;

        await prisma.reminder
          .update({
            where: { id: reminder.id },
            data: {
              status: ReminderStatus.FAILED,
              retryCount: nextRetryCount,
              isEscalated: reachedMaxRetries,
              escalatedAt: reachedMaxRetries ? new Date() : reminder.escalatedAt,
              escalationNotes: `[${new Date().toISOString()}] Dispatch exception: ${errorMessage}`,
            },
          })
          .catch(() => undefined);

        failedCount += 1;
        if (reachedMaxRetries) {
          escalatedCount += 1;
        }

        results.push({
          reminderId: reminder.id,
          patientId: reminder.patientId,
          recipientEmail: reminder.patient.email,
          status: 'FAILED',
          provider,
          providerMessageId: null,
          retryCount: nextRetryCount,
          isEscalated: reachedMaxRetries,
          error: errorMessage,
        });
      }
    }

    const completedAt = new Date().toISOString();

    return {
      startedAt,
      completedAt,
      durationMs: Date.now() - startTimeMs,
      dryRun,
      provider,
      totalPending: pendingReminders.length,
      sentCount,
      failedCount,
      escalatedCount,
      results,
    };
  }
}
