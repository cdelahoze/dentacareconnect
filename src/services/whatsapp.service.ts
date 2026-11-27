import twilio from 'twilio';
import crypto from 'crypto';
import { NotificationChannel, ReminderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export interface WhatsAppReminderPayload {
  procedureId: string;
  customMessage?: string;
}

export class WhatsAppService {
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
      throw new ApiError(
        500,
        'Invalid TWILIO_ACCOUNT_SID format. It must start with "AC".'
      );
    }

    if (!this.client) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }

    return this.client;
  }

  /**
   * Normalize phone numbers into Twilio E.164 WhatsApp format: whatsapp:+[country][number]
   */
  private static formatWhatsAppNumber(rawPhone: string): string {
    const cleaned = rawPhone.replace(/whatsapp:/i, '').replace(/[^\d+]/g, '');
    const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    return `whatsapp:${withPlus}`;
  }

  /**
   * Build personalized reminder message including patient name, procedure, target control date, and booking link
   */
  private static buildPersonalizedMessage(params: {
    firstName: string;
    procedureName: string;
    nextControlDate: Date;
    bookingLink: string;
    dentistName?: string | null;
  }): string {
    const formattedDate = params.nextControlDate.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const doctorLine = params.dentistName ? ` con ${params.dentistName}` : '';

    return (
      `🦷 *DentaCare Connect - Recordatorio de Control Clínico*\n\n` +
      `Hola *${params.firstName}*, esperamos que tu recuperación vaya muy bien.\n\n` +
      `De acuerdo con tu procedimiento de *${params.procedureName}*${doctorLine}, ` +
      `tu cita de control odontológico está programada alrededor del *${formattedDate}*.\n\n` +
      `📅 Agenda tu horario fácilmente sin necesidad de contraseña en el siguiente enlace:\n` +
      `${params.bookingLink}\n\n` +
      `_Si ya agendaste tu cita, por favor ignora este mensaje._`
    );
  }

  /**
   * Send a personalized WhatsApp reminder for a specific clinical procedure and log the audit record
   */
  static async sendProcedureReminder(payload: WhatsAppReminderPayload) {
    const procedure = await prisma.patientProcedure.findUnique({
      where: { id: payload.procedureId },
      include: {
        patient: true,
        procedure: true,
        performedBy: true,
        appointments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!procedure) {
      throw new ApiError(404, `Procedure with ID ${payload.procedureId} not found.`);
    }

    const patient = procedure.patient;
    const rawRecipientPhone = patient.phone;

    if (!rawRecipientPhone) {
      throw new ApiError(
        400,
        `Patient ${patient.firstName} ${patient.lastName} does not have a valid phone or WhatsApp number.`
      );
    }

    const formattedRecipient = this.formatWhatsAppNumber(rawRecipientPhone);
    const formattedFrom = this.formatWhatsAppNumber(env.TWILIO_WHATSAPP_FROM);

    const bookingToken = crypto.randomUUID();
    const bookingLink = `${env.CLIENT_URL}/schedule/${bookingToken}`;

    const messageBody =
      payload.customMessage?.trim() ||
      this.buildPersonalizedMessage({
        firstName: patient.firstName,
        procedureName: procedure.procedure.name,
        nextControlDate: procedure.followUpDueDate,
        bookingLink,
        dentistName: procedure.performedBy
          ? `${procedure.performedBy.firstName} ${procedure.performedBy.lastName}`
          : null,
      });

    // Create initial PENDING reminder audit record
    const reminderRecord = await prisma.reminder.create({
      data: {
        patientId: patient.id,
        patientProcedureId: procedure.id,
        channel: NotificationChannel.WHATSAPP,
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

      // Update Reminder to SENT and record Twilio Message SID
      const updatedReminder = await prisma.reminder.update({
        where: { id: reminderRecord.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          externalMessageId: twilioResponse.sid,
          errorMessage: null,
        },
      });

      return {
        reminder: updatedReminder,
        twilioSid: twilioResponse.sid,
        twilioStatus: twilioResponse.status,
      };
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error dispatching Twilio WhatsApp message.';

      await prisma.reminder.update({
        where: { id: reminderRecord.id },
        data: {
          status: ReminderStatus.FAILED,
          errorMessage: errorMsg,
        },
      });

      throw new ApiError(502, `Twilio WhatsApp delivery failed: ${errorMsg}`);
    }
  }

  /**
   * Handle Twilio Webhook status callbacks (sent, delivered, read, failed)
   */
  static async handleStatusWebhook(messageSid: string, messageStatus: string, errorMessage?: string) {
    const reminder = await prisma.reminder.findFirst({
      where: {
        externalMessageId: messageSid,
      },
    });

    if (!reminder) {
      return null;
    }

    let mappedStatus: ReminderStatus = reminder.status;
    const normalized = messageStatus.toLowerCase();

    if (normalized === 'delivered' || normalized === 'read') {
      mappedStatus = ReminderStatus.DELIVERED;
    } else if (normalized === 'sent' || normalized === 'queued') {
      mappedStatus = ReminderStatus.SENT;
    } else if (normalized === 'failed' || normalized === 'undelivered') {
      mappedStatus = ReminderStatus.FAILED;
    }

    return await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: mappedStatus,
        ...(errorMessage && { errorMessage }),
      },
    });
  }

  /**
   * Retrieve reminder delivery history (optionally filtered by procedureId or patientId)
   */
  static async getReminderLogs(filters?: { procedureId?: string; patientId?: string }) {
    return await prisma.reminder.findMany({
      where: {
        channel: NotificationChannel.WHATSAPP,
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
