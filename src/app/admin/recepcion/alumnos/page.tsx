import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { AlumnosTable } from "./alumnos-table";
import { GraduationCap, Users, FileCheck } from "lucide-react";
import type { Role } from "@prisma/client";

export default async function AlumnosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "alta_rapida");
  if (access === "none") redirect("/admin");
  const canEdit = access === "full";
  const gruposAccess = await hasModuleAccess(session.user as { id: string; role: Role }, "grupos");
  const canEnroll = gruposAccess === "full" || gruposAccess === "initiate";

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const [students, groups] = await Promise.all([
    prisma.student.findMany({
      where: campusWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        campus: { select: { name: true } },
        parentLinks: { include: { parent: { select: { name: true, email: true } } } },
        enrollments: {
          where: { completedAt: null },
          take: 1,
          select: { group: { select: { name: true, level: { select: { name: true } } } } },
        },
      },
    }),
    canEnroll
      ? prisma.group.findMany({
          where: campusWhere,
          select: { id: true, name: true, campusId: true, level: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const conTutor = students.filter((s) => s.parentLinks.length > 0).length;
  const documentosCompletos = students.filter((s) => s.entregaActa && s.entregaCurp && s.entregaComprobante).length;

  return (
    <div>
      <h1 className="text-lg font-semibold">Alumnos</h1>
      <p className="mt-1 text-sm text-muted">Datos de contacto, tutor y documentación de cada alumno.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={GraduationCap} label="Total de alumnos" value={students.length} />
        <KpiCard icon={Users} label="Con tutor registrado" value={conTutor} />
        <KpiCard icon={FileCheck} label="Documentación completa" value={documentosCompletos} />
      </div>

      <div className="mt-6">
        <AlumnosTable
          students={students}
          canEdit={canEdit}
          isAdmin={role === "ADMIN"}
          groups={groups.map((g) => ({ id: g.id, campusId: g.campusId, label: `${g.level.name} · ${g.name}` }))}
        />
      </div>
    </div>
  );
}
