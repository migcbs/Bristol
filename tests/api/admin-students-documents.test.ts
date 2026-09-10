import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/campus-scope", () => ({ assertCampusInScope: vi.fn() }));
vi.mock("@/lib/staff-permissions", () => ({ hasModuleAccess: vi.fn() }));
vi.mock("@/lib/student-document-storage", () => ({
  saveStudentDocument: vi.fn(),
  readStudentDocument: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findUnique: vi.fn(), update: vi.fn() },
    studentDocument: { findUnique: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { saveStudentDocument, readStudentDocument } from "@/lib/student-document-storage";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/admin/students/[id]/documents/route";
import { GET } from "@/app/api/admin/students/[id]/documents/[tipo]/route";

function ctx(id = "s1") {
  return { params: Promise.resolve({ id }) };
}
function ctxWithTipo(id = "s1", tipo = "ACTA") {
  return { params: Promise.resolve({ id, tipo }) };
}

describe("POST /api/admin/students/[id]/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller only has read access (not full)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    const res = await POST(new Request("http://localhost", { method: "POST" }), ctx());
    expect(res.status).toBe(403);
  });

  it("rejects an invalid file type", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });

    const formData = new FormData();
    formData.append("tipo", "ACTA");
    formData.append("file", new File(["hola"], "acta.exe", { type: "application/x-msdownload" }));
    const req = new Request("http://localhost", { method: "POST", body: formData });

    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
    expect(saveStudentDocument).not.toHaveBeenCalled();
  });

  it("saves the file and marks entregaActa true on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("full");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (saveStudentDocument as any).mockResolvedValue("s1/ACTA.pdf");
    (prisma.$transaction as any).mockResolvedValue([{ id: "doc1", tipo: "ACTA", fileName: "acta.pdf" }]);

    const formData = new FormData();
    formData.append("tipo", "ACTA");
    formData.append("file", new File(["%PDF-1.4"], "acta.pdf", { type: "application/pdf" }));
    const req = new Request("http://localhost", { method: "POST", body: formData });

    const res = await POST(req, ctx());
    expect(res.status).toBe(201);
    expect(saveStudentDocument).toHaveBeenCalledWith("s1", "ACTA", "acta.pdf", expect.any(Buffer));
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe("GET /api/admin/students/[id]/documents/[tipo]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without a session", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost"), ctxWithTipo());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller's puesto has no alta_rapida access", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("none");
    const res = await GET(new Request("http://localhost"), ctxWithTipo());
    expect(res.status).toBe(403);
  });

  it("returns 404 when no document has been uploaded for that type", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (prisma.studentDocument.findUnique as any).mockResolvedValue(null);

    const res = await GET(new Request("http://localhost"), ctxWithTipo());
    expect(res.status).toBe(404);
  });

  it("streams the file with the right content type on success", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", role: "STAFF" } });
    (hasModuleAccess as any).mockResolvedValue("read");
    (assertCampusInScope as any).mockResolvedValue(true);
    (prisma.student.findUnique as any).mockResolvedValue({ id: "s1", campusId: "c1" });
    (prisma.studentDocument.findUnique as any).mockResolvedValue({
      id: "doc1",
      storageKey: "s1/ACTA.pdf",
      mimeType: "application/pdf",
      fileName: "acta.pdf",
      sizeBytes: 4,
    });
    (readStudentDocument as any).mockResolvedValue(Buffer.from("%PDF"));

    const res = await GET(new Request("http://localhost"), ctxWithTipo());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
  });
});
