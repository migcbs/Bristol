import { prisma } from "@/lib/prisma";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { getStudentAnalytics } from "@/lib/student-analytics";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { StudentProgressPanel } from "@/components/portal/student-progress-panel";
import { GraduationCap, CalendarCheck, Wallet, MessageSquare, Clock, BookOpen, Award } from "lucide-react";
import type { Role } from "@prisma/client";

export async function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!student) {
    return (
      <div>
        <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Tu cuenta todavía no está vinculada a un expediente de alumno." />

      <PendingBanner userId={userId} />
      </div>
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [activeEnrollment, enrollmentIds] = await Promise.all([
    prisma.enrollment.findFirst({
      where: { studentId: student.id, completedAt: null },
      include: { group: { include: { level: true } } },
    }),
    prisma.enrollment.findMany({ where: { studentId: student.id }, select: { id: true } }).then((rows) => rows.map((r) => r.id)),
  ]);

  const [gradesAvg, attendanceTotal, attendancePresent, campusIds] = await Promise.all([
    prisma.grade.aggregate({ where: { enrollmentId: { in: enrollmentIds } }, _avg: { score: true } }),
    prisma.attendanceRecord.count({ where: { enrollmentId: { in: enrollmentIds }, date: { gte: thirtyDaysAgo } } }),
    prisma.attendanceRecord.count({
      where: { enrollmentId: { in: enrollmentIds }, date: { gte: thirtyDaysAgo }, status: "PRESENT" },
    }),
    getRecipientCampusIds({ id: userId, role: "STUDENT" as Role }),
  ]);

  const avisosRecientes = await prisma.announcement.count({
    where: { ...announcementAudienceWhere({ role: "STUDENT" as Role }, campusIds), createdAt: { gte: sevenDaysAgo } },
  });

  const promedio = gradesAvg._avg.score !== null ? Math.round(gradesAvg._avg.score) : null;
  const asistenciaPct = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : null;

  const analytics = await getStudentAnalytics(student.id);

  return (
    <div>
      <DashboardGreeting
        greeting={`Hola, ${name.split(" ")[0]}`}
        subtitle={activeEnrollment ? `Estás en ${activeEnrollment.group.level.name} · ${activeEnrollment.group.name}.` : "Todavía no tienes un grupo activo."}
      />

      <PendingBanner userId={userId} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Award} label="Promedio general" value={promedio !== null ? promedio : "—"} />
        <KpiCard icon={CalendarCheck} label="Asistencia (30 días)" value={asistenciaPct !== null ? `${asistenciaPct}%` : "—"} tone="accent" />
        <KpiCard icon={MessageSquare} label="Avisos esta semana" value={avisosRecientes} />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Tu avance</h2>
      <div className="mt-3">
        <StudentProgressPanel analytics={analytics} />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/portal/horario" icon={Clock} label="Horario" description="Días y horas de tu clase" />
        <QuickActionTile href="/portal/calificaciones" icon={GraduationCap} label="Calificaciones" description="Tu historial de notas" />
        <QuickActionTile href="/portal/materiales" icon={BookOpen} label="Materiales" description="Lo que ha compartido tu maestro" />
        <QuickActionTile href="/portal/cobranzas" icon={Wallet} label="Cobranzas" description="Estatus y pago de tus cargos" />
        <QuickActionTile href="/portal/comunicaciones" icon={MessageSquare} label="Comunicaciones" description="Avisos de la escuela" />
      </RevealGrid>
    </div>
  );
}
