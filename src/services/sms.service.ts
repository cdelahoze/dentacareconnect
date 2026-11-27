import twilio from 'twilio';
import crypto from 'crypto';
import { NotificationChannel, ReminderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export interface SmsReminderPayload {
  procedureId: string;
  customMessage?: string;
  isFallback?: boolean;
}

export class SmsService {
  private static client: twilio.Twilio | null = null;

  /**
   * Lazy-initialize and validate the Twilio SDK client
   */
  private static getTwilioClient(): twilio.Twilio {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new ApiError(
        500,
        'Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) are missing in environment variables.'
      );
    }

    if (!env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
      throw new ApiError(500, 'Invalid TWILIO_ACCOUNT_SID format. It must start with "AC".');
    }

    if (!this.client) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }

    return this.client;
  }

  /**
   * Normalize phone numbers into strict E.164 format (+[country][number]) for SMS
   */
  private static formatE164PhoneNumber(rawPhone: string): string {
    const cleaned = rawPhone.replace(/whatsapp:/i, '').replace(/[^\d+]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  /**
   * Build concise SMS message (<160-300 chars) optimized for standard cellular networks without data
   */
  private static buildConciseSmsMessage(params: {
    firstName: string;
    procedureName: string;
    nextControlDate: Date;
    bookingLink: string;
  }): string {
    const formattedDate = params.nextControlDate.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return (
      `DentaCare: Hola ${params.firstName}, recuerda tu control de ${params.procedureName} ` +
      `para el ${formattedDate}. Agenda tu cita aqui: ${params.bookingLink}`
    );
  }

  /**
   * Dispatch an SMS reminder (direct or as automated failover when WhatsApp fails/lacks data)
   */
  static async sendProcedureSmsReminder(payload: SmsReminderPayload) {
    if (!env.TWILIO_SMS_FROM) {
      throw new ApiError(
        500,
        'TWILIO_SMS_FROM is not configured in environment variables (e.g., +15017122661).'
      );
    }

    const patientProcedure = await prisma.patientProcedure.findUnique({
      where: { id: payload.procedureId },
      include: {
        patient: true,
        procedure: true,
      },
    });

    if (!patientProcedure) {
      throw new ApiError(404, `Procedure with ID ${payload.procedureId} not found.`);
    }

    const patient = patientProcedure.patient;
    const rawPhone = patient.phone;

    if (!rawPhone) {
      throw new ApiError(
        400,
        `Patient ${patient.firstName} ${patient.lastName} does not have a valid phone number for SMS.`
      );
    }

    const formattedRecipient = this.formatE164PhoneNumber(rawPhone);
    const formattedFrom = this.formatE164PhoneNumber(env.TWILIO_SMS_FROM);

    const bookingToken = crypto.randomUUID();
    const bookingLink = `${env.CLIENT_URL}/schedule/${bookingToken}`;

    const messageBody =
      payload.customMessage?.trim() ||
      this.buildConciseSmsMessage({
        firstName: patient.firstName,
        procedureName: patientProcedure.procedure.name,
        nextControlDate: patientProcedure.followUpDueDate,
        bookingLink,
      });

    // Create initial PENDING reminder audit record under SMS channel
    const reminderRecord = await prisma.reminder.create({
      data: {
        patientId: patient.id,
        patientProcedureId: patientProcedure.id,
        channel: NotificationChannel.SMS,
        messageContent: messageBody,
        bookingToken,
        bookingUrl: bookingLink,
        scheduledFor: new Date(),
        status: ReminderStatus.PENDING,
      },
    });

    try {
      const client = this.getTwilioClient();

      const twilioResponse = await client.messages.create({
        from: formattedFrom,
        to: formattedRecipient,
        body: messageBody,
      });

      const updatedReminder = await prisma.reminder.update({
        where: { id: reminderRecord.id },
        data: {
          status: ReminderStatus.SENT,
          externalMessageId: twilioResponse.sid,
          sentAt: new Date(),
        },
      });

      return {
        reminder: updatedReminder,
        channel: NotificationChannel.SMS,
        isFallback: Boolean(payload.isFallback),
        twilioSid: twilioResponse.sid,
        twilioStatus: twilioResponse.status,
      };
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error dispatching Twilio SMS message.';

      await prisma.reminder.update({
        where: { id: reminderRecord.id },
        data: {
          status: ReminderStatus.FAILED,
          errorMessage: errorMsg,
        },
      });

      throw new ApiError(502, `Twilio SMS delivery failed: ${errorMsg}`);
    }
  }

  /**
   * Retrieve SMS reminder audit logs (?procedureId=&patientId=)
   */
  static async getSmsLogs(filters?: { procedureId?: string; patientId?: string }) {
    return await prisma.reminder.findMany({
      where: {
        channel: NotificationChannel.SMS,
        ...(filters?.procedureId && { patientProcedureId: filters.procedureId }),
        ...(filters?.patientId && { patientId: filters.patientId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        patientProcedure: {
          include: {
            procedure: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });
  }
}
