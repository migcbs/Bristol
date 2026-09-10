import { auth } from "@/lib/auth";
import { assertCampusInScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { isValidCurp } from "@/lib/validation";
import { verifyPassword } from "@/lib/password";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { Role, Sexo } from "@prisma/client";

const VALID_SEXO: Sexo[] = ["MASCULINO", "FEMENINO"];
const MAX_TEXT_FIELD = 200;

function assertAdminOrStaff(role: string) {
  return role === "ADMIN" || role === "STAFF";
}

// Every field here is optional — Recepción fills this in over time as
// documents/details come in, not necessarily all at once.
interface EditableFields {
  curp?: string;
  fechaNacimiento?: string;
  sexo?: Sexo;
  telefonoFijo?: string;
  telefonoMovil?: string;
  emailContacto?: string;
  domicilioCalle?: string;
  domicilioNumero?: string;
  domicilioColonia?: string;
  domicilioCP?: string;
  domicilioCiudad?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
  entregaActa?: boolean;
  entregaCurp?: boolean;
  entregaComprobante?: boolean;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "alta_rapida");
  if (access === "none") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } }, campus: { select: { name: true } } },
  });
  if (!student) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, student.campusId);
    if (!inScope) {
      return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
    }
  }

  return Response.json(student);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "alta_rapida");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, existing.campusId);
    if (!inScope) {
      return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
    }
  }

  let body: EditableFields;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const textFields: (keyof EditableFields)[] = [
    "telefonoFijo",
    "telefonoMovil",
    "emailContacto",
    "domicilioCalle",
    "domicilioNumero",
    "domicilioColonia",
    "domicilioCP",
    "domicilioCiudad",
    "contactoEmergenciaNombre",
    "contactoEmergenciaTelefono",
  ];
  for (const field of textFields) {
    const value = body[field];
    if (value !== undefined && (typeof value !== "string" || value.length > MAX_TEXT_FIELD)) {
      return Response.json({ error: "Uno o más campos exceden la longitud permitida" }, { status: 400 });
    }
  }

  if (body.curp !== undefined && body.curp !== "" && !isValidCurp(body.curp)) {
    return Response.json({ error: "El formato de la CURP no es válido" }, { status: 400 });
  }

  if (body.sexo !== undefined && !VALID_SEXO.includes(body.sexo)) {
    return Response.json({ error: "Sexo inválido" }, { status: 400 });
  }

  let fechaNacimiento: Date | undefined;
  if (body.fechaNacimiento !== undefined && body.fechaNacimiento !== "") {
    fechaNacimiento = new Date(body.fechaNacimiento);
    if (Number.isNaN(fechaNacimiento.getTime())) {
      return Response.json({ error: "Fecha de nacimiento inválida" }, { status: 400 });
    }
  }

  const student = await prisma.student.update({
    where: { id },
    data: {
      ...(body.curp !== undefined && { curp: body.curp || null }),
      ...(fechaNacimiento !== undefined && { fechaNacimiento }),
      ...(body.sexo !== undefined && { sexo: body.sexo }),
      ...(body.telefonoFijo !== undefined && { telefonoFijo: body.telefonoFijo || null }),
      ...(body.telefonoMovil !== undefined && { telefonoMovil: body.telefonoMovil || null }),
      ...(body.emailContacto !== undefined && { emailContacto: body.emailContacto || null }),
      ...(body.domicilioCalle !== undefined && { domicilioCalle: body.domicilioCalle || null }),
      ...(body.domicilioNumero !== undefined && { domicilioNumero: body.domicilioNumero || null }),
      ...(body.domicilioColonia !== undefined && { domicilioColonia: body.domicilioColonia || null }),
      ...(body.domicilioCP !== undefined && { domicilioCP: body.domicilioCP || null }),
      ...(body.domicilioCiudad !== undefined && { domicilioCiudad: body.domicilioCiudad || null }),
      ...(body.contactoEmergenciaNombre !== undefined && {
        contactoEmergenciaNombre: body.contactoEmergenciaNombre || null,
      }),
      ...(body.contactoEmergenciaTelefono !== undefined && {
        contactoEmergenciaTelefono: body.contactoEmergenciaTelefono || null,
      }),
      ...(typeof body.entregaActa === "boolean" && { entregaActa: body.entregaActa }),
      ...(typeof body.entregaCurp === "boolean" && { entregaCurp: body.entregaCurp }),
      ...(typeof body.entregaComprobante === "boolean" && { entregaComprobante: body.entregaComprobante }),
    },
  });

  return Response.json(student);
}

// Deleting a student is destructive and cascades (enrollments, invoices,
// incidents, parent links, outreach logs — see the Student relations in
// prisma/schema.prisma, all onDelete: Cascade off the User row). Per the
// user's explicit instruction 2026-09-09: whoever isn't ADMIN must have an
// actual administrator type their password in, right there, to approve it —
// a step-up authorization check, not a session for that admin. An ADMIN
// deleting directly needs no extra password (redundant with their own
// session).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (!assertAdminOrStaff(role)) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "alta_rapida");
  if (access !== "full") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.student.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) {
    return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  if (role === "STAFF") {
    const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, existing.campusId);
    if (!inScope) {
      return Response.json({ error: "Alumno no encontrado" }, { status: 404 });
    }
  }

  let approvedByName: string;
  if (role === "ADMIN") {
    approvedByName = session.user.name as string;
  } else {
    let body: { adminEmail?: string; adminPassword?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Se requiere la contraseña de un administrador para eliminar" }, { status: 400 });
    }
    if (!body.adminEmail || !body.adminPassword) {
      return Response.json({ error: "Se requiere la contraseña de un administrador para eliminar" }, { status: 400 });
    }

    const admin = await prisma.user.findUnique({ where: { email: body.adminEmail.trim().toLowerCase() } });
    if (!admin || admin.role !== "ADMIN" || !(await verifyPassword(body.adminPassword, admin.passwordHash))) {
      return Response.json({ error: "Credenciales de administrador inválidas" }, { status: 403 });
    }
    approvedByName = admin.name;
  }

  // Deleting the User cascades to Student and everything hanging off it.
  await prisma.user.delete({ where: { id: existing.user.id } });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((a) =>
      notify(
        a.id,
        `${session.user!.name} eliminó al alumno ${existing.user.name} (aprobado por ${approvedByName})`
      )
    )
  );

  return Response.json({ ok: true });
}
