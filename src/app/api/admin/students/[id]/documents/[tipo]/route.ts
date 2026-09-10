import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { readStudentDocument } from "@/lib/student-document-storage";
import { prisma } from "@/lib/prisma";
import type { Role, StudentDocumentType } from "@prisma/client";

const VALID_TYPES: StudentDocumentType[] = ["ACTA", "CURP", "COMPROBANTE"];

// Viewing/downloading a document only needs "consultar" access — any
// level short of "none" on alta_rapida, matching the user's ask that
// these become real "botones que me permita consultar esa información".
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; tipo: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }
  const access = await hasModuleAccess(actor, "alta_rapida");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: studentId, tipo } = await params;
  if (!VALID_TYPES.includes(tipo as StudentDocumentType)) {
    return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, student.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const document = await prisma.studentDocument.findUnique({
    where: { studentId_tipo: { studentId, tipo: tipo as StudentDocumentType } },
  });
  if (!document) {
    return Response.json({ error: "No hay documento cargado" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readStudentDocument(document.storageKey);
  } catch (error) {
    console.error("No se pudo leer el documento del alumno:", error);
    return Response.json({ error: "El archivo no está disponible" }, { status: 500 });
  }

  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(document.fileName)}"`,
      "Content-Length": String(document.sizeBytes),
      "Cache-Control": "private, no-store",
    },
  });
}
