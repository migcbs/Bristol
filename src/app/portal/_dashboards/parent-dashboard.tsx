import { prisma } from "@/lib/prisma";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { getStudentAnalytics } from "@/lib/student-analytics";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { StudentProgressPanel } from "@/components/portal/student-progress-panel";
import { Users, GraduationCap, Wallet, MessageSquare, Clock, BookOpen } from "lucide-react";
import type { Role } from "@prisma/client";

export async function ParentDashboard({ userId, name }: { userId: string; name: string }) {
  const links = await prisma.parentStudent.findMany({
    where: { parentUserId: userId },
    select: { student: { select: { id: true, user: { select: { name: true } } } } },
  });
  const children = links.map((l) => ({ id: l.student.id, name: l.student.user.name }));
  const studentIds = children.map((c) => c.id);

  const childAnalytics = await Promise.all(
    children.map(async (c) => ({ ...c, analytics: await getStudentAnalytics(c.id) }))
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [cargosPendientes, campusIds] = await Promise.all([
    studentIds.length
      ? prisma.invoice.count({ where: { studentId: { in: studentIds }, status: { in: ["PENDING", "OVERDUE"] } } })
      : Promise.resolve(0),
    getRecipientCampusIds({ id: userId, role: "PARENT" as Role }),
  ]);

  const avisosRecientes = await prisma.announcement.count({
    where: { ...announcementAudienceWhere({ role: "PARENT" as Role }, campusIds), createdAt: { gte: sevenDaysAgo } },
  });

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que necesitas saber hoy." />

      <PendingBanner userId={userId} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Users} label="Hijos inscritos" value={studentIds.length} />
        <KpiCard icon={Wallet} label="Cargos pendientes" value={cargosPendientes} tone="accent" />
        <KpiCard icon={MessageSquare} label="Avisos esta semana" value={avisosRecientes} />
      </RevealGrid>

      {childAnalytics.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">
            {childAnalytics.length === 1 ? "Avance de tu hijo" : "Avance de tus hijos"}
          </h2>
          <div className="mt-3 space-y-6">
            {childAnalytics.map((c) => (
              <StudentProgressPanel key={c.id} analytics={c.analytics} heading={c.name} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/portal/calificaciones" icon={GraduationCap} label="Calificaciones" description="Historial de notas de tus hijos" />
        <QuickActionTile href="/portal/horario" icon={Clock} label="Horario" description="Días y horas de su clase" />
        <QuickActionTile href="/portal/materiales" icon={BookOpen} label="Materiales" description="Lo que ha compartido su maestro" />
        <QuickActionTile href="/portal/cobranzas" icon={Wallet} label="Cobranzas" description="Estatus y pago de cargos" />
        <QuickActionTile href="/portal/comunicaciones" icon={MessageSquare} label="Comunicaciones" description="Avisos de la escuela" />
      </RevealGrid>
    </div>
  );
}
