import {
  NotificationChannel,
  ReminderStatus,
  TreatmentStatus,
} from '@prisma/client';
import { env } from '../config/env';
import {
  DueProcedureRecord,
  FollowUpQueueEntry,
  FollowUpUrgency,
  QueuedReminderRecord,
} from '../types/controlEngine.types';

export const getStartOfDay = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const classifyUrgency = (
  followUpDueDate: Date,
  referenceDate: Date,
  status?: TreatmentStatus
): FollowUpUrgency => {
  const startOfToday = getStartOfDay(referenceDate);
  const endOfToday = getEndOfDay(referenceDate);

  if (status === TreatmentStatus.OVERDUE || followUpDueDate < startOfToday) {
    return 'OVERDUE';
  }
  if (followUpDueDate <= endOfToday) {
    return 'DUE_TODAY';
  }
  return 'UPCOMING';
};

export const buildBookingUrl = (bookingToken: string): string => {
  const baseUrl = env.CLIENT_URL.replace(/\/+$/, '');
  return `${baseUrl}/portal/book?token=${bookingToken}`;
};

export const buildReminderMessage = (
  firstName: string,
  procedureName: string,
  urgency: FollowUpUrgency,
  bookingUrl: string
): string => {
  if (urgency === 'OVERDUE') {
    return `Hi ${firstName}, your ${procedureName} follow-up control is overdue. Please book your appointment as soon as possible: ${bookingUrl}`;
  }
  if (urgency === 'DUE_TODAY') {
    return `Hi ${firstName}, your ${procedureName} follow-up control is due today. Confirm your appointment slot here: ${bookingUrl}`;
  }
  return `Hi ${firstName}, your ${procedureName} follow-up control is coming up soon. Reserve your preferred chair time here: ${bookingUrl}`;
};

export const hasActiveOrCurrentCycleReminder = (
  reminders: DueProcedureRecord['reminders'],
  startOfToday: Date,
  endOfToday: Date
): boolean => {
  return reminders.some((reminder) => {
    if (reminder.status === ReminderStatus.PENDING) {
      return true;
    }

    const isScheduledToday =
      reminder.scheduledFor >= startOfToday && reminder.scheduledFor <= endOfToday;

    return isScheduledToday && reminder.status !== ReminderStatus.CANCELLED;
  });
};

export const createEmptyUrgencyCounts = (): Record<FollowUpUrgency, number> => ({
  OVERDUE: 0,
  DUE_TODAY: 0,
  UPCOMING: 0,
});

export const createEmptyChannelCounts = (): Record<NotificationChannel, number> => ({
  EMAIL: 0,
  WHATSAPP: 0,
  SMS: 0,
});

export const buildQueueEntryFromProcedure = (params: {
  record: DueProcedureRecord;
  reminderId: string | null;
  reminderStatus: ReminderStatus;
  scheduledFor: Date;
  urgency: FollowUpUrgency;
  bookingToken: string;
  bookingUrl: string;
  messageContent: string;
}): FollowUpQueueEntry => {
  const { record } = params;

  return {
    reminderId: params.reminderId,
    patient: {
      id: record.patient.id,
      firstName: record.patient.firstName,
      lastName: record.patient.lastName,
      fullName: `${record.patient.firstName} ${record.patient.lastName}`.trim(),
      email: record.patient.email,
      phone: record.patient.phone,
      preferredChannel: record.patient.preferredChannel,
    },
    channel: record.patient.preferredChannel,
    procedure: {
      patientProcedureId: record.id,
      procedureId: record.procedure.id,
      name: record.procedure.name,
      code: record.procedure.code,
      category: record.procedure.category,
      procedureDate: record.procedureDate,
      status: record.status,
    },
    followUpDueDate: record.followUpDueDate,
    urgency: params.urgency,
    bookingToken: params.bookingToken,
    bookingUrl: params.bookingUrl,
    reminderStatus: params.reminderStatus,
    scheduledFor: params.scheduledFor,
    messageContent: params.messageContent,
  };
};

export const buildQueueEntryFromReminder = (
  reminder: QueuedReminderRecord,
  urgency: FollowUpUrgency
): FollowUpQueueEntry | null => {
  if (!reminder.patientProcedure) {
    return null;
  }

  return {
    reminderId: reminder.id,
    patient: {
      id: reminder.patient.id,
      firstName: reminder.patient.firstName,
      lastName: reminder.patient.lastName,
      fullName: `${reminder.patient.firstName} ${reminder.patient.lastName}`.trim(),
      email: reminder.patient.email,
      phone: reminder.patient.phone,
      preferredChannel: reminder.patient.preferredChannel,
    },
    channel: reminder.channel,
    procedure: {
      patientProcedureId: reminder.patientProcedure.id,
      procedureId: reminder.patientProcedure.procedure.id,
      name: reminder.patientProcedure.procedure.name,
      code: reminder.patientProcedure.procedure.code,
      category: reminder.patientProcedure.procedure.category,
      procedureDate: reminder.patientProcedure.procedureDate,
      status: reminder.patientProcedure.status,
    },
    followUpDueDate: reminder.patientProcedure.followUpDueDate,
    urgency,
    bookingToken: reminder.bookingToken,
    bookingUrl: reminder.bookingUrl ?? buildBookingUrl(reminder.bookingToken),
    reminderStatus: reminder.status,
    scheduledFor: reminder.scheduledFor,
    messageContent: reminder.messageContent ?? '',
  };
};
