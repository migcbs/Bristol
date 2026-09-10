import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Returns the WhatsApp deep-link recipients for an announcement.
//
// Honest limitation, stated plainly rather than papered over: Bristol has
// no WhatsApp Business API configured, so nothing here sends anything —
// the client builds wa.me links a staff member clicks one by one. And
// only `Student.telefonoMovil` exists in the data model; parents and
// teachers have no phone field, so they can't get a deep link at all —
// for them the announcement modal offers a "copiar mensaje" button to
// paste into a WhatsApp group by hand. This route therefore only returns
// students (with a mobile number) who match the announcement's audience.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }
  if (announcement.audience === "CAMPUS" && announcement.campusId && actor.role === "STAFF") {
    const inScope = await assertCampusInScope(actor, announcement.campusId);
    if (!inScope) {
      return Response.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const scope = await getCampusScope(actor);
  const scopeCampusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  // ROLE announcements to a non-student role have no phone recipients at all.
  const targetsStudents =
    announcement.audience === "ALL" ||
    announcement.audience === "CAMPUS" ||
    (announcement.audience === "ROLE" && announcement.role === "STUDENT");

  let recipients: { name: string; phone: string }[] = [];
  if (targetsStudents) {
    const campusFilter =
      announcement.audience === "CAMPUS" && announcement.campusId
        ? { campusId: announcement.campusId }
        : scopeCampusWhere;
    const students = await prisma.student.findMany({
      where: { ...campusFilter, telefonoMovil: { not: null } },
      select: { telefonoMovil: true, user: { select: { name: true } } },
    });
    recipients = students
      .filter((s) => s.telefonoMovil && s.telefonoMovil.replace(/\D/g, "").length >= 10)
      .map((s) => ({ name: s.user.name, phone: s.telefonoMovil! }));
  }

  return Response.json({
    message: `${announcement.title}\n\n${announcement.body}`,
    recipients,
  });
}
