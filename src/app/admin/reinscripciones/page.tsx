import { auth } from "@/lib/auth";
import { getCampusScope, enrollmentScopeWhere } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { MapPin, GraduationCap } from "lucide-react";
import { ReenrollRowActions } from "@/components/admin/reenroll-row-actions";

export default async function ReinscripcionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "reinscripciones");
  if (access === "none") redirect("/admin/tickets");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const enrollmentWhere = enrollmentScopeWhere(scope);

  const enrollments = await prisma.enrollment.findMany({
    where: enrollmentWhere,
    orderBy: { enrolledAt: "asc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } }, campus: true } },
      group: { include: { level: true } },
    },
  });

  const campusIds = [...new Set(enrollments.map((e) => e.student.campusId))];
  const groups = campusIds.length
    ? await prisma.group.findMany({
        where: { campusId: { in: campusIds } },
        include: { level: true },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Reinscripciones</h1>
      <p className="mt-1 text-sm text-muted">
        Promueve a un alumno al siguiente nivel o cámbialo entre horarios (sabatino / entre semana). Cada
        reinscripción cierra la inscripción actual y abre una nueva en el grupo destino, conservando el historial
        académico del alumno. Actúa sobre un alumno a la vez.
      </p>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {enrollments.map((enrollment) => {
          const campusGroups = groups
            .filter((g) => g.campusId === enrollment.student.campusId && g.id !== enrollment.groupId)
            .map((g) => ({ id: g.id, label: `${g.level.code} · ${g.name}` }));

          return (
            <RecordCard
              key={enrollment.id}
              avatarId={enrollment.student.user.id}
              avatarLabel={enrollment.student.user.name.trim().charAt(0).toUpperCase() || "?"}
              name={enrollment.student.user.name}
              meta={
                <span className="flex items-center gap-1">
                  <MapPin size={11} /> {enrollment.student.campus.name}
                </span>
              }
              tags={
                <>
                  <Tag tone="blue" icon={GraduationCap}>
                    {enrollment.group.level.code} · {enrollment.group.name}
                  </Tag>
                  {campusGroups.length === 0 && (
                    <span className="text-xs text-muted">Sin otros grupos disponibles</span>
                  )}
                </>
              }
              actions={
                campusGroups.length > 0 ? (
                  <ReenrollRowActions
                    enrollmentId={enrollment.id}
                    studentName={enrollment.student.user.name}
                    currentGroupLabel={`${enrollment.group.level.code} · ${enrollment.group.name}`}
                    groups={campusGroups}
                  />
                ) : undefined
              }
            />
          );
        })}
      </div>

      {enrollments.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No hay inscripciones activas que mostrar.</p>
      )}
    </div>
  );
}
