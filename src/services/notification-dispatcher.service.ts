import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import prisma from '../config/prisma';
import { ApiError } from '../utils/ApiError';

export interface SmartDispatchPayload {
  procedureId: string;
  customMessage?: string;
}

/**
 * Orchestrates primary WhatsApp delivery with automatic SMS failover
 * for patients without WhatsApp or active mobile data connections.
 */
export class NotificationDispatcherService {
  static async dispatchWithFailover(payload: SmartDispatchPayload) {
    const procedure = await prisma.patientProcedure.findUnique({
      where: { id: payload.procedureId },
      include: { patient: true },
    });

    if (!procedure) {
      throw new ApiError(404, `Procedure with ID ${payload.procedureId} not found.`);
    }

    const patient = procedure.patient;

    // Case 1: Route directly to SMS when WhatsApp is not the patient's preferred channel.
    if (patient.preferredChannel !== 'WHATSAPP') {
      const smsResult = await SmsService.sendProcedureSmsReminder({
        procedureId: payload.procedureId,
        customMessage: payload.customMessage,
        isFallback: true,
      });

      return {
        primaryChannelAttempted: 'NONE (WhatsApp is not preferred)',
        finalChannelUsed: 'SMS',
        fallbackTriggered: true,
        reason: 'Patient does not prefer WhatsApp reminders.',
        delivery: smsResult,
      };
    }

    // Case 2: Attempt WhatsApp first; if delivery fails, automatically failover to SMS
    try {
      const whatsappResult = await WhatsAppService.sendProcedureReminder({
        procedureId: payload.procedureId,
        customMessage: payload.customMessage,
      });

      return {
        primaryChannelAttempted: 'WHATSAPP',
        finalChannelUsed: 'WHATSAPP',
        fallbackTriggered: false,
        delivery: whatsappResult,
      };
    } catch (whatsappError: unknown) {
      const failureReason =
        whatsappError instanceof Error
          ? whatsappError.message
          : 'WhatsApp dispatch failed unexpectedly.';

      console.warn(
        `[FAILOVER] WhatsApp failed for procedure ${payload.procedureId} (${failureReason}). Switching to SMS gateway...`
      );

      const smsResult = await SmsService.sendProcedureSmsReminder({
        procedureId: payload.procedureId,
        customMessage: payload.customMessage,
        isFallback: true,
      });

      return {
        primaryChannelAttempted: 'WHATSAPP',
        finalChannelUsed: 'SMS',
        fallbackTriggered: true,
        reason: failureReason,
        delivery: smsResult,
      };
    }
  }
}
