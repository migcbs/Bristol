import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { generateMatricula } from "@/lib/matricula";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validation";
import type { Role } from "@prisma/client";
import crypto from "node:crypto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { name?: string; email?: string; campusId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email || !body.campusId || !isValidEmail(email)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  if (role === "STAFF") {
    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const inScope = scope.type === "ALL" || (scope.type === "CAMPUS_LIST" && scope.campusIds.includes(body.campusId));
    if (!inScope) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const temporaryPassword = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);

  const student = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, role: "STUDENT", passwordHash },
    });
    const matricula = await generateMatricula(tx);
    return tx.student.create({
      data: { userId: user.id, campusId: body.campusId!, matricula },
    });
  });

  return Response.json(student, { status: 201 });
}
