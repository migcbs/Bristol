import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ getCampusScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendReciboFiscalEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { sendReciboFiscalEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/invoices/[id]/enviar-recibo/route";

function ctx(id = "i1") {
  return { params: Promise.resolve({ id }) };
}

function request() {
  return new Request("http://localhost/api/admin/invoices/i1/enviar-recibo", { method: "POST" });
}

const baseInvoice = {
  id: "i1",
  status: "PAID",
  description: "Colegiatura",
  amountCents: 150000,
  paidAt: new Date("2026-09-01"),
  student: {
    campusId: "c1",
    rfc: null,
    razonSocial: null,
    regimenFiscal: null,
    codigoPostalFiscal: null,
    usoCfdi: null,
    user: { email: "alumno@example.com" },
    parentLinks: [],
  },
};

describe("POST /api/admin/invoices/[id]/enviar-recibo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(request(), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 403 without full/initiate cobranzas access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(request(), ctx());
    expect(res.status).toBe(403);
  });

  it("returns 400 when the invoice isn't paid", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({ ...baseInvoice, status: "PENDING" });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });

    const res = await POST(request(), ctx());
    expect(res.status).toBe(400);
    expect(sendReciboFiscalEmail).not.toHaveBeenCalled();
  });

  it("emails the student directly when no tutor is linked, with no fiscal block", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue(baseInvoice);
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (sendReciboFiscalEmail as any).mockResolvedValue(undefined);
    (prisma.invoice.update as any).mockResolvedValue({ ...baseInvoice, reciboFiscalEnviado: true });

    const res = await POST(request(), ctx());
    expect(res.status).toBe(200);
    expect(sendReciboFiscalEmail).toHaveBeenCalledWith(
      "alumno@example.com",
      expect.objectContaining({ fiscal: null })
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { reciboFiscalEnviado: true, reciboFiscalEnviadoAt: expect.any(Date) },
    });
  });

  it("prefers the linked tutor's email and fiscal data over the student's", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue({
      ...baseInvoice,
      student: {
        ...baseInvoice.student,
        parentLinks: [{ parent: { email: "tutor@example.com", rfc: "TUTO900101ABC", razonSocial: null, regimenFiscal: null, codigoPostalFiscal: null, usoCfdi: null } }],
      },
    });
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (sendReciboFiscalEmail as any).mockResolvedValue(undefined);
    (prisma.invoice.update as any).mockResolvedValue({});

    const res = await POST(request(), ctx());
    expect(res.status).toBe(200);
    expect(sendReciboFiscalEmail).toHaveBeenCalledWith(
      "tutor@example.com",
      expect.objectContaining({ fiscal: expect.objectContaining({ rfc: "TUTO900101ABC" }) })
    );
  });

  it("returns 502 and does not flag reciboFiscalEnviado when the email send fails", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (prisma.invoice.findUnique as any).mockResolvedValue(baseInvoice);
    (getCampusScope as any).mockResolvedValue({ type: "ALL" });
    (sendReciboFiscalEmail as any).mockRejectedValue(new Error("Resend error: API key is invalid"));

    const res = await POST(request(), ctx());
    expect(res.status).toBe(502);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
