import crypto from 'crypto';
import { Resend } from 'resend';
import { env } from '../config/env';
import {
  EmailDeliveryResult,
  SendEmailInput,
  SupportedEmailProvider,
} from '../types/email.types';

const RETRYABLE_ERROR_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /network/i,
  /5\d{2}/,
  /internal server error/i,
  /service unavailable/i,
];

const isRetryableError = (message: string): boolean =>
  RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));

const logEmailEvent = (
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, unknown>
): void => {
  const payload = JSON.stringify({
    service: 'email-service',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
};

export class EmailService {
  private static resendClient: Resend | null = null;

  /**
   * Resolve the active email transport. Falls back to 'mock' when no API key is configured
   * so local development and automated tests never crash.
   */
  static resolveActiveProvider(): SupportedEmailProvider {
    if (env.EMAIL_PROVIDER === 'mock') {
      return 'mock';
    }

    if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY.trim().length > 0) {
      return 'resend';
    }

    return 'mock';
  }

  private static getResendClient(): Resend {
    if (!this.resendClient) {
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
    return this.resendClient;
  }

  /**
   * Send a transactional email using Resend or the safe local/dev fallback transport.
   * Never throws; returns a structured EmailDeliveryResult with retry metadata.
   */
  static async sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
    const provider = this.resolveActiveProvider();
    const fromAddress = input.from ?? env.EMAIL_FROM;

    if (!input.to || !input.to.includes('@')) {
      return {
        status: 'FAILED',
        provider,
        messageId: null,
        sentAt: null,
        error: `Invalid recipient email address: "${input.to}"`,
        retryable: false,
      };
    }

    if (provider === 'mock') {
      const mockMessageId = `mock_${crypto.randomUUID()}`;
      const sentAt = new Date();

      logEmailEvent('info', 'email_dispatched_mock_transport', {
        provider,
        messageId: mockMessageId,
        to: input.to,
        from: fromAddress,
        subject: input.subject,
        reason:
          env.EMAIL_PROVIDER === 'mock'
            ? 'EMAIL_PROVIDER=mock'
            : 'RESEND_API_KEY not configured; using safe dev fallback transport',
      });

      return {
        status: 'SENT',
        provider,
        messageId: mockMessageId,
        sentAt,
        retryable: false,
      };
    }

    try {
      const client = this.getResendClient();
      const { data, error } = await client.emails.send({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.tags ? { tags: input.tags } : {}),
      });

      if (error) {
        const errorMessage = error.message || 'Resend API returned an unknown error';
        const retryable = isRetryableError(errorMessage);

        logEmailEvent('error', 'email_dispatch_provider_error', {
          provider,
          to: input.to,
          error: errorMessage,
          errorName: error.name,
          retryable,
        });

        return {
          status: 'FAILED',
          provider,
          messageId: null,
          sentAt: null,
          error: errorMessage,
          retryable,
        };
      }

      const sentAt = new Date();
      const messageId = data?.id ?? null;

      logEmailEvent('info', 'email_dispatched_resend', {
        provider,
        messageId,
        to: input.to,
        subject: input.subject,
      });

      return {
        status: 'SENT',
        provider,
        messageId,
        sentAt,
        retryable: false,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unexpected exception while sending email';
      const retryable = isRetryableError(errorMessage);

      logEmailEvent('error', 'email_dispatch_exception', {
        provider,
        to: input.to,
        error: errorMessage,
        retryable,
      });

      return {
        status: 'FAILED',
        provider,
        messageId: null,
        sentAt: null,
        error: errorMessage,
        retryable,
      };
    }
  }
}
