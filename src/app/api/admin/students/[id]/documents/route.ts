import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { saveStudentDocument } from "@/lib/student-document-storage";
import { prisma } from "@/lib/prisma";
import type { Role, StudentDocumentType } from "@prisma/client";

const VALID_TYPES: StudentDocumentType[] = ["ACTA", "CURP", "COMPROBANTE"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Uploading (or replacing) one of a student's three documents — the real
// file behind the entregaActa/entregaCurp/entregaComprobante flags. Same
// "full" access as editing the student record (see AlumnoEditModal).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "alta_rapida");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: studentId } = await params;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const tipo = formData.get("tipo");
  const file = formData.get("file");
  if (typeof tipo !== "string" || !VALID_TYPES.includes(tipo as StudentDocumentType)) {
    return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "El archivo debe pesar entre 1 byte y 10MB" }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return Response.json({ error: "Solo se aceptan PDF, JPG, PNG o WEBP" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = await saveStudentDocument(studentId, tipo as StudentDocumentType, file.name, bytes);

  const entregaField =
    tipo === "ACTA" ? "entregaActa" : tipo === "CURP" ? "entregaCurp" : "entregaComprobante";

  const [document] = await prisma.$transaction([
    prisma.studentDocument.upsert({
      where: { studentId_tipo: { studentId, tipo: tipo as StudentDocumentType } },
      create: {
        studentId,
        tipo: tipo as StudentDocumentType,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: actor.id,
      },
      update: {
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: actor.id,
        uploadedAt: new Date(),
      },
    }),
    prisma.student.update({ where: { id: studentId }, data: { [entregaField]: true } }),
  ]);

  return Response.json({ id: document.id, tipo: document.tipo, fileName: document.fileName }, { status: 201 });
}
