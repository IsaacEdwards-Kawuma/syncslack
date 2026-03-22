/**
 * Optional SMTP (Render: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
 * If unset, password-reset / verify links are logged to the server console.
 */
export async function sendMail({ to, subject, text, html }) {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.log('[mail] (no SMTP) would send to', to, 'subject:', subject);
    console.log(text?.slice(0, 500));
    return { ok: false, skipped: true };
  }
  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@localhost';
  await transporter.sendMail({ from, to, subject, text, html: html || text });
  return { ok: true };
}

export function publicAppBaseUrl() {
  const u = process.env.APP_PUBLIC_URL || process.env.CLIENT_ORIGIN?.split(',')[0]?.trim();
  return u?.replace(/\/$/, '') || 'http://localhost:5173';
}
