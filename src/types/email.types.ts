import { FollowUpUrgency } from './controlEngine.types';

export type SupportedEmailProvider = 'resend' | 'mock';

export type EmailDeliveryStatus = 'SENT' | 'FAILED';

export interface EmailTag {
  name: string;
  value: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  tags?: EmailTag[];
}

export interface EmailDeliveryResult {
  status: EmailDeliveryStatus;
  provider: string;
  messageId: string | null;
  sentAt: Date | null;
  error?: string;
  retryable: boolean;
}

export interface FollowUpEmailTemplateData {
  patientName: string;
  procedureName: string;
  followUpDueDate: Date;
  urgency: FollowUpUrgency;
  bookingToken: string;
  bookingUrl?: string;
  clinicName?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  clinicAddress?: string;
}

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export interface EmailDispatchOptions {
  referenceDate?: Date;
  dryRun?: boolean;
  limit?: number;
}

export interface EmailDispatchItemResult {
  reminderId: string;
  patientId: string;
  recipientEmail: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED_DRY_RUN';
  provider: string;
  providerMessageId: string | null;
  retryCount: number;
  isEscalated: boolean;
  error?: string;
}

export interface EmailDispatchBatchResult {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  dryRun: boolean;
  provider: string;
  totalPending: number;
  sentCount: number;
  failedCount: number;
  escalatedCount: number;
  results: EmailDispatchItemResult[];
}
