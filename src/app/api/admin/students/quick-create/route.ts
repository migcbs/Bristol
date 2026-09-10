import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { generateMatricula } from "@/lib/matricula";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validation";
import type { Role } from "@prisma/client";
import crypto from "node:crypto";

const MAX_MATRICULA_ATTEMPTS = 3;

function isMatriculaCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const err = error as { code?: unknown; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  return !target || JSON.stringify(target).includes("matricula");
}

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { name?: string; email?: string; campusId?: string; tutorName?: string; tutorEmail?: string; leadId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const tutorName = body.tutorName?.trim() || undefined;
  const tutorEmail = body.tutorEmail?.trim() || undefined;

  if (!name || !email || !body.campusId || !isValidEmail(email)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (name.length > 120 || email.length > 254) {
    return Response.json({ error: "Uno o más campos exceden la longitud permitida" }, { status: 400 });
  }

  // A tutor is either fully provided (name + valid email) or not provided
  // at all — no half-filled tutor records.
  if ((tutorName && !tutorEmail) || (tutorEmail && !tutorName)) {
    return Response.json({ error: "Captura el nombre y correo del tutor, o ninguno" }, { status: 400 });
  }
  if (tutorEmail && !isValidEmail(tutorEmail)) {
    return Response.json({ error: "Correo del tutor inválido" }, { status: 400 });
  }
  if (tutorEmail && tutorEmail === email) {
    return Response.json({ error: "El alumno y el tutor no pueden compartir el mismo correo" }, { status: 400 });
  }
  if (tutorName && tutorName.length > 120) {
    return Response.json({ error: "Uno o más campos exceden la longitud permitida" }, { status: 400 });
  }

  if (role === "STAFF") {
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return Response.json({ error: "Ya existe una cuenta con este correo electrónico" }, { status: 409 });
  }

  if (body.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) {
      return Response.json({ error: "Lead no encontrado" }, { status: 404 });
    }
  }

  let existingTutor: { id: string } | null = null;
  if (tutorEmail) {
    existingTutor = await prisma.user.findUnique({ where: { email: tutorEmail }, select: { id: true } });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const tutorTemporaryPassword = tutorEmail && !existingTutor ? generateTemporaryPassword() : undefined;
  const tutorPasswordHash = tutorTemporaryPassword ? await hashPassword(tutorTemporaryPassword) : undefined;

  let student;
  let tutorUserId: string | undefined = existingTutor?.id;
  let lastError: unknown;
  let attempt = 0;
  while (attempt < MAX_MATRICULA_ATTEMPTS) {
    attempt++;
    try {
      student = await prisma.$transaction(async (tx) => {
        // Recepción verifies identity in person — the account doesn't need
        // the usual email-verification-link loop, and staff need the
        // temporary password to actually be usable on first login.
        const user = await tx.user.create({
          data: {
            name,
            email,
            role: "STUDENT",
            passwordHash,
            emailVerifiedAt: new Date(),
            mustChangePassword: true,
          },
        });
        const matricula = await generateMatricula(tx);
        const createdStudent = await tx.student.create({
          data: { userId: user.id, campusId: body.campusId!, matricula },
        });

        if (tutorEmail && tutorName) {
          const tutor =
            existingTutor ??
            (await tx.user.create({
              data: {
                name: tutorName,
                email: tutorEmail,
                role: "PARENT",
                passwordHash: tutorPasswordHash!,
                emailVerifiedAt: new Date(),
                mustChangePassword: true,
              },
            }));
          tutorUserId = tutor.id;
          await tx.parentStudent.create({
            data: { parentUserId: tutor.id, studentId: createdStudent.id },
          });
        }

        // "Inscribir" from Admisiones — confirmed with the user 2026-09-09:
        // clicking it should actually do something, not just flip a status
        // dropdown. This is that "something": the lead becomes a real
        // Student account, and the lead itself is marked ENROLLED in the
        // same transaction so the two can never disagree.
        if (body.leadId) {
          await tx.lead.update({ where: { id: body.leadId! }, data: { status: "ENROLLED" } });
        }

        return createdStudent;
      });
      lastError = undefined;
      break;
    } catch (error) {
      if (isMatriculaCollision(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    return Response.json(
      { error: "No se pudo generar una matrícula única, intenta de nuevo" },
      { status: 500 }
    );
  }

  return Response.json(
    {
      ...student,
      temporaryPassword,
      tutor: tutorUserId
        ? {
            id: tutorUserId,
            email: tutorEmail,
            temporaryPassword: tutorTemporaryPassword,
            alreadyExisted: !!existingTutor,
          }
        : null,
    },
    { status: 201 }
  );
}
