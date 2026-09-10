import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Bristol <no-reply@bristol-ingles.com>";

function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

// The Resend SDK (v6) does NOT throw on an API-level failure (bad/missing
// key, invalid recipient, etc) — it logs a "[Resend API Error]" line and
// resolves with `{ data: null, error }` instead. Every send* helper below
// routes through this so a failed send surfaces as a thrown error the
// caller's try/catch actually sees, instead of silently looking like success
// (caught live: enviar-recibo was marking `reciboFiscalEnviado: true` on a
// 401 "API key is invalid").
async function sendOrThrow(params: Parameters<typeof resend.emails.send>[0]): Promise<void> {
  const { error } = await resend.emails.send(params);
  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/verify-email?token=${token}`);
  await sendOrThrow({
    from: FROM,
    to,
    subject: "Verifica tu cuenta de Bristol",
    html: `<p>Confirma tu cuenta de Bristol dando clic <a href="${url}">aquí</a>.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = appUrl(`/reset-password?token=${token}`);
  await sendOrThrow({
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
  await sendOrThrow({
    from: FROM,
    to,
    subject: announcement.title,
    html: `<p>${safeBody}</p>`,
  });
}

// NOT a real SAT-stamped CFDI — Bristol has no PAC integration. This is just
// an emailed receipt that includes the payer's captured fiscal data, so they
// have a record to reconcile against their own accounting. See the
// `Invoice.reciboFiscalEnviado` comment in prisma/schema.prisma.
export async function sendReciboFiscalEmail(
  to: string,
  recibo: {
    concepto: string;
    montoFormatted: string;
    fechaPago: string;
    fiscal: { rfc?: string | null; razonSocial?: string | null; regimenFiscal?: string | null; codigoPostalFiscal?: string | null; usoCfdi?: string | null } | null;
  }
): Promise<void> {
  const fiscalRows = recibo.fiscal
    ? `
      <tr><td>RFC</td><td>${escapeHtml(recibo.fiscal.rfc ?? "—")}</td></tr>
      <tr><td>Razón social</td><td>${escapeHtml(recibo.fiscal.razonSocial ?? "—")}</td></tr>
      <tr><td>Régimen fiscal</td><td>${escapeHtml(recibo.fiscal.regimenFiscal ?? "—")}</td></tr>
      <tr><td>Código postal fiscal</td><td>${escapeHtml(recibo.fiscal.codigoPostalFiscal ?? "—")}</td></tr>
      <tr><td>Uso de CFDI</td><td>${escapeHtml(recibo.fiscal.usoCfdi ?? "—")}</td></tr>
    `
    : "";
  await sendOrThrow({
    from: FROM,
    to,
    subject: "Recibo de pago — Bristol Inglés Profesional",
    html: `
      <p>Este es tu recibo de pago. No sustituye una factura fiscal timbrada ante el SAT.</p>
      <table cellpadding="6">
        <tr><td>Concepto</td><td>${escapeHtml(recibo.concepto)}</td></tr>
        <tr><td>Monto</td><td>${escapeHtml(recibo.montoFormatted)}</td></tr>
        <tr><td>Fecha de pago</td><td>${escapeHtml(recibo.fechaPago)}</td></tr>
        ${fiscalRows}
      </table>
    `,
  });
}
