import { env } from '../config/env';
import { FollowUpUrgency } from '../types/controlEngine.types';
import { EmailTemplateOutput, FollowUpEmailTemplateData } from '../types/email.types';

interface UrgencyPresentation {
  badgeLabel: string;
  badgeBgColor: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  subjectPrefix: string;
  headline: string;
  introMessage: string;
}

const DEFAULT_CLINIC_INFO = {
  name: 'DentaCare Connect Clinic',
  phone: '(555) 234-5678',
  email: 'care@dentacareconnect.com',
  address: '1200 Dental Wellness Ave, Suite 200',
};

const URGENCY_PRESENTATIONS: Record<FollowUpUrgency, UrgencyPresentation> = {
  OVERDUE: {
    badgeLabel: 'OVERDUE',
    badgeBgColor: '#FEE2E2',
    badgeTextColor: '#991B1B',
    badgeBorderColor: '#FCA5A5',
    subjectPrefix: 'Action Required: Overdue',
    headline: 'Your dental follow-up is overdue',
    introMessage:
      'Our records show your post-procedure follow-up visit is past its recommended date. Timely check-ups help ensure proper healing and prevent complications.',
  },
  DUE_TODAY: {
    badgeLabel: 'DUE TODAY',
    badgeBgColor: '#FEF3C7',
    badgeTextColor: '#92400E',
    badgeBorderColor: '#FCD34D',
    subjectPrefix: 'Reminder: Due Today —',
    headline: 'Your dental follow-up is due today',
    introMessage:
      'Your recommended follow-up check-up is due today. Please use the button below to choose a convenient appointment slot.',
  },
  UPCOMING: {
    badgeLabel: 'UPCOMING',
    badgeBgColor: '#DBEAFE',
    badgeTextColor: '#1E40AF',
    badgeBorderColor: '#93C5FD',
    subjectPrefix: 'Upcoming Follow-Up:',
    headline: 'Your dental follow-up is coming up',
    introMessage:
      'It is almost time for your scheduled dental follow-up control. Reserve your preferred chair time in just a few clicks.',
  },
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatFollowUpDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);

export const buildSelfServiceBookingUrl = (bookingToken: string): string => {
  const baseUrl = env.APP_BASE_URL.replace(/\/+$/, '');
  return `${baseUrl}/book/${encodeURIComponent(bookingToken)}`;
};

/**
 * Build responsive, inline-styled HTML and plain-text follow-up reminder emails
 * compatible with Gmail, Outlook, and Apple Mail.
 */
export const buildFollowUpReminderEmail = (
  data: FollowUpEmailTemplateData
): EmailTemplateOutput => {
  const presentation = URGENCY_PRESENTATIONS[data.urgency];
  const formattedDueDate = formatFollowUpDate(data.followUpDueDate);
  const bookingUrl = data.bookingUrl ?? buildSelfServiceBookingUrl(data.bookingToken);

  const clinicName = data.clinicName ?? DEFAULT_CLINIC_INFO.name;
  const clinicPhone = data.clinicPhone ?? DEFAULT_CLINIC_INFO.phone;
  const clinicEmail = data.clinicEmail ?? DEFAULT_CLINIC_INFO.email;
  const clinicAddress = data.clinicAddress ?? DEFAULT_CLINIC_INFO.address;

  const safePatientName = escapeHtml(data.patientName);
  const safeProcedureName = escapeHtml(data.procedureName);
  const safeDueDate = escapeHtml(formattedDueDate);
  const safeBookingUrl = escapeHtml(bookingUrl);
  const safeClinicName = escapeHtml(clinicName);
  const safeClinicPhone = escapeHtml(clinicPhone);
  const safeClinicEmail = escapeHtml(clinicEmail);
  const safeClinicAddress = escapeHtml(clinicAddress);

  const subject = `${presentation.subjectPrefix} ${data.procedureName} Follow-Up | ${clinicName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F3F4F6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0F766E;padding:24px 32px;text-align:left;">
              <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#CCFBF1;font-weight:600;">
                ${safeClinicName}
              </p>
              <h1 style="margin:8px 0 0 0;font-size:22px;line-height:1.3;color:#FFFFFF;font-weight:700;">
                ${escapeHtml(presentation.headline)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <!-- Urgency Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background-color:${presentation.badgeBgColor};color:${presentation.badgeTextColor};border:1px solid ${presentation.badgeBorderColor};border-radius:9999px;padding:4px 12px;font-size:12px;font-weight:700;letter-spacing:0.05em;">
                    ${presentation.badgeLabel}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#111827;">
                Hello <strong>${safePatientName}</strong>,
              </p>

              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#374151;">
                ${escapeHtml(presentation.introMessage)}
              </p>

              <!-- Procedure Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;width:40%;">Procedure</td>
                        <td style="padding:4px 0;font-size:14px;color:#111827;font-weight:600;">${safeProcedureName}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;width:40%;">Follow-Up Due Date</td>
                        <td style="padding:4px 0;font-size:14px;color:#111827;font-weight:600;">${safeDueDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${safeBookingUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#0F766E;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 28px;border-radius:8px;">
                      Schedule Follow-Up Appointment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#6B7280;text-align:center;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#0F766E;text-align:center;word-break:break-all;">
                <a href="${safeBookingUrl}" style="color:#0F766E;text-decoration:underline;">${safeBookingUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer / Clinic Contact Info -->
          <tr>
            <td style="background-color:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 32px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#374151;">
                ${safeClinicName}
              </p>
              <p style="margin:0 0 4px 0;font-size:12px;color:#6B7280;">
                ${safeClinicAddress}
              </p>
              <p style="margin:0;font-size:12px;color:#6B7280;">
                Phone: ${safeClinicPhone} &bull; Email: <a href="mailto:${safeClinicEmail}" style="color:#0F766E;text-decoration:none;">${safeClinicEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${clinicName} — ${presentation.headline.toUpperCase()}`,
    `Status: ${presentation.badgeLabel}`,
    '',
    `Hello ${data.patientName},`,
    '',
    presentation.introMessage,
    '',
    `Procedure: ${data.procedureName}`,
    `Follow-Up Due Date: ${formattedDueDate}`,
    '',
    `Schedule your follow-up appointment online: ${bookingUrl}`,
    '',
    '---',
    clinicName,
    clinicAddress,
    `Phone: ${clinicPhone} | Email: ${clinicEmail}`,
  ].join('\n');

  return { subject, html, text };
};
