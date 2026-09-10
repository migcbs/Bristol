import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { GroupForm } from "@/components/admin/group-form";
import { GroupCard } from "@/components/admin/group-card";
import type { Role } from "@prisma/client";

// Dirección de Campus creates groups (relating a teacher, level/curso and
// campus) and can add both students and teachers to them — confirmed with
// the user 2026-09-09. Moving a student here (via AddStudentToGroupModal)
// closes their previous active enrollment and opens a new one without
// deleting anything, so grades/progreso from e.g. a sabatino group survive
// the move to an escolarizado one; see /api/admin/groups/[id]/enroll.
export default async function GruposPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const actor = session.user as { id: string; role: Role };
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(actor, "grupos");
  if (access === "none") redirect("/admin");
  const canManage = access === "full";

  const scope = await getCampusScope(actor);
  const where =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const [groups, campuses, levels, cursos, teachers] = await Promise.all([
    prisma.group.findMany({
      where,
      include: {
        campus: true,
        level: true,
        teacher: { select: { id: true, name: true } },
        scheduleSlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        enrollments: {
          where: { completedAt: null },
          include: { student: { select: { matricula: true, user: { select: { name: true } } } } },
          orderBy: { enrolledAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    canManage
      ? scope.type === "ALL"
        ? prisma.campus.findMany({ orderBy: { name: "asc" } })
        : scope.type === "CAMPUS_LIST"
          ? prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
          : []
      : [],
    canManage ? prisma.level.findMany({ orderBy: { name: "asc" } }) : [],
    canManage ? prisma.curso.findMany({ orderBy: { nombre: "asc" } }) : [],
    canManage ? prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <div>
      <h1 className="text-lg font-semibold">Grupos</h1>
      <p className="mt-1 text-sm text-muted">
        {canManage
          ? "Crea grupos y asigna su maestro y alumnos."
          : "Consulta de los grupos existentes."}
      </p>

      {canManage && (
        <div className="mt-6">
          <GroupForm
            campuses={campuses}
            levels={levels.map((l) => ({ id: l.id, name: l.name }))}
            cursos={cursos.map((c) => ({ id: c.id, name: c.nombre }))}
            teachers={teachers.map((t) => ({ id: t.id, name: t.name ?? "" }))}
          />
        </div>
      )}

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            groupId={group.id}
            groupName={`${group.level.name} · ${group.name}`}
            campusName={group.campus.name}
            teacherName={group.teacher.name}
            teacherId={group.teacherId}
            cupoMaximo={group.cupoMaximo}
            estatusGrupo={group.estatusGrupo}
            scheduleSlots={group.scheduleSlots}
            roster={group.enrollments.map((e) => ({
              studentId: e.studentId,
              name: e.student.user.name,
              matricula: e.student.matricula,
            }))}
            canManage={canManage}
            teachers={teachers.map((t) => ({ id: t.id, name: t.name ?? "" }))}
          />
        ))}
      </div>
      {groups.length === 0 && <p className="mt-6 text-center text-sm text-muted">No hay grupos.</p>}
    </div>
  );
}
