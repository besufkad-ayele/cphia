type RegistrationEmailInput = {
  to: string;
  registrationId: string;
  firstName: string;
  lastName: string;
  sector: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isUsableFromAddress(value: string) {
  return Boolean(value) && !value.includes('yourdomain.com');
}

export function isRegistrationEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim()) && isUsableFromAddress(process.env.EMAIL_FROM?.trim() ?? '');
}

export async function sendRegistrationEmail(input: RegistrationEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? '';
  if (!apiKey || !isUsableFromAddress(from)) return false;

  const name = `${input.firstName} ${input.lastName}`.replace(/\s+/g, ' ').trim();
  const subject = `CPHIA 2026 volunteer ID ${input.registrationId}`;
  const text = [
    `Hello ${name},`,
    '',
    'Your CPHIA 2026 Facility Volunteer registration is complete.',
    `Volunteer ID: ${input.registrationId}`,
    `Sector: ${input.sector}`,
    '',
    'Keep this ID for check-in and training days.',
    '',
    'CPHIA 2026 Facility Volunteer Training',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#122623;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7e3e0;">
            <tr>
              <td style="background:#0A3F3A;color:#ffffff;padding:20px 24px;">
                <p style="margin:0;font-size:12px;letter-spacing:0.16em;font-weight:700;">CPHIA 2026</p>
                <p style="margin:6px 0 0;font-size:18px;">Facility Volunteer ID</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:16px;">Hello ${escapeHtml(name)},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Your registration is complete. Keep this volunteer ID for check-in and training days.</p>
                <p style="margin:0 0 6px;font-size:12px;color:#5b6f6c;letter-spacing:0.08em;">VOLUNTEER ID</p>
                <p style="margin:0 0 16px;font-size:28px;font-weight:700;color:#0A3F3A;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.registrationId)}</p>
                <p style="margin:0;font-size:14px;color:#3d524e;">Sector: ${escapeHtml(input.sector)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px;font-size:12px;color:#6b7c79;">
                CPHIA 2026 Facility Volunteer Training
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        html,
        text,
      }),
    });
    if (!response.ok) {
      console.error('registration_email_failed', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error('registration_email_error', error);
    return false;
  }
}
