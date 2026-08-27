import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Bristol <no-reply@bristol-ingles.com>";

function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/verify-email?token=${token}`);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verifica tu cuenta de Bristol",
    html: `<p>Confirma tu cuenta de Bristol dando clic <a href="${url}">aquí</a>.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/reset-password?token=${token}`);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Restablece tu contraseña de Bristol",
    html: `<p>Restablece tu contraseña dando clic <a href="${url}">aquí</a>. Este enlace expira en 1 hora.</p>`,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendAnnouncementEmail(
  to: string,
  announcement: { title: string; body: string }
): Promise<void> {
  const safeBody = escapeHtml(announcement.body).replace(/\n/g, "<br>");
  await resend.emails.send({
    from: FROM,
    to,
    subject: announcement.title,
    html: `<p>${safeBody}</p>`,
  });
}
