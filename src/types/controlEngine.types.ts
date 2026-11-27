import {
  NotificationChannel,
  Prisma,
  ReminderStatus,
  TreatmentStatus,
} from '@prisma/client';
import type { EmailDispatchBatchResult } from './email.types';

export type FollowUpUrgency = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';

export const dueProcedureInclude = Prisma.validator<Prisma.PatientProcedureInclude>()({
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      preferredChannel: true,
      isActive: true,
    },
  },
  procedure: {
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      defaultFollowUpDays: true,
    },
  },
  reminders: {
    select: {
      id: true,
      status: true,
      scheduledFor: true,
      bookingToken: true,
      bookingUrl: true,
      channel: true,
      messageContent: true,
    },
    orderBy: {
      scheduledFor: 'desc',
    },
  },
});

export type DueProcedureRecord = Prisma.PatientProcedureGetPayload<{
  include: typeof dueProcedureInclude;
}>;

export const reminderQueueInclude = Prisma.validator<Prisma.ReminderInclude>()({
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      preferredChannel: true,
    },
  },
  patientProcedure: {
    include: {
      procedure: {
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
        },
      },
    },
  },
});

export type QueuedReminderRecord = Prisma.ReminderGetPayload<{
  include: typeof reminderQueueInclude;
}>;

export interface FollowUpQueuePatient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  preferredChannel: NotificationChannel;
}

export interface FollowUpQueueProcedure {
  patientProcedureId: string;
  procedureId: string;
  name: string;
  code: string | null;
  category: string | null;
  procedureDate: Date;
  status: TreatmentStatus;
}

export interface FollowUpQueueEntry {
  reminderId: string | null;
  patient: FollowUpQueuePatient;
  channel: NotificationChannel;
  procedure: FollowUpQueueProcedure;
  followUpDueDate: Date;
  urgency: FollowUpUrgency;
  bookingToken: string;
  bookingUrl: string;
  reminderStatus: ReminderStatus;
  scheduledFor: Date;
  messageContent: string;
}

export interface ControlEngineRunOptions {
  referenceDate?: Date;
  windowDays?: number;
  dryRun?: boolean;
}

export interface ControlEngineSummaryCounts {
  transitionedToOverdue: number;
  eligibleDueProcedures: number;
  newlyQueuedReminders: number;
  skippedExistingReminders: number;
  byUrgency: Record<FollowUpUrgency, number>;
  byChannel: Record<NotificationChannel, number>;
}

export interface ControlEngineRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  referenceDate: string;
  windowDays: number;
  dryRun: boolean;
  summary: ControlEngineSummaryCounts;
  queue: FollowUpQueueEntry[];
  emailDispatch: EmailDispatchBatchResult;
}

export interface QueueQueryFilters {
  date?: Date;
  urgency?: FollowUpUrgency;
  channel?: NotificationChannel;
}

export interface DailyQueueResponse {
  date: string;
  total: number;
  byUrgency: Record<FollowUpUrgency, number>;
  byChannel: Record<NotificationChannel, number>;
  queue: FollowUpQueueEntry[];
}

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  isExecuting: boolean;
  schedule: string;
  timezone: string | null;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastError: string | null;
}
