import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import { QuickActionTile } from "@/components/admin/dashboard/quick-action-tile";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { PendingBanner } from "@/components/admin/dashboard/pending-banner";
import { RevealGrid } from "@/components/admin/dashboard/reveal-grid";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { BarChart, ColumnChart, DonutChart } from "@/components/ui/charts";
import { Users, GraduationCap, CalendarCheck, Clock, BookOpen, Library, AlertTriangle, FileText } from "lucide-react";

export async function TeacherDashboard({ userId, name }: { userId: string; name: string }) {
  const today = new Date().getDay();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [groups, gruposCount, alumnosActivos, clasesHoy, grades, attendanceRows] = await Promise.all([
    prisma.group.findMany({
      where: { teacherId: userId },
      select: {
        id: true,
        name: true,
        level: { select: { code: true } },
        _count: { select: { enrollments: { where: { completedAt: null } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.group.count({ where: { teacherId: userId } }),
    prisma.enrollment.count({ where: { completedAt: null, group: { teacherId: userId } } }),
    prisma.scheduleSlot.count({ where: { dayOfWeek: today, group: { teacherId: userId } } }),
    prisma.grade.findMany({
      where: { enrollment: { group: { teacherId: userId } } },
      select: { score: true, maxScore: true, enrollment: { select: { groupId: true, studentId: true } } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { enrollment: { group: { teacherId: userId } }, date: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
  ]);

  // Per-group average (grades normalised to 0–100).
  const norm = (g: { score: number; maxScore: number }) => (g.score / (g.maxScore || 100)) * 100;
  const groupAverages = groups.map((g) => {
    const gs = grades.filter((x) => x.enrollment.groupId === g.id);
    const avg = gs.length ? Math.round(gs.reduce((a, x) => a + norm(x), 0) / gs.length) : 0;
    return { label: `${g.level.code} · ${g.name}`, value: avg };
  });

  // Per-student average across the teacher's classes → at-risk count (<70).
  const byStudent = new Map<string, number[]>();
  for (const x of grades) {
    const arr = byStudent.get(x.enrollment.studentId) ?? [];
    arr.push(norm(x));
    byStudent.set(x.enrollment.studentId, arr);
  }
  const studentAverages = [...byStudent.values()].map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
  const enRiesgo = studentAverages.filter((a) => a < 70).length;

  // Grade distribution buckets across every grade the teacher has entered.
  const buckets = [
    { label: "0–59", value: 0, colorClass: "bg-accent" },
    { label: "60–69", value: 0, colorClass: "bg-amber-400" },
    { label: "70–79", value: 0, colorClass: "bg-amber-300" },
    { label: "80–89", value: 0, colorClass: "bg-emerald-300" },
    { label: "90–100", value: 0, colorClass: "bg-emerald-500" },
  ];
  for (const x of grades) {
    const v = norm(x);
    const i = v < 60 ? 0 : v < 70 ? 1 : v < 80 ? 2 : v < 90 ? 3 : 4;
    buckets[i].value += 1;
  }

  const byStatus = new Map(attendanceRows.map((r) => [r.status, r._count._all]));
  const present = byStatus.get("PRESENT") ?? 0;
  const late = byStatus.get("LATE") ?? 0;
  const absent = byStatus.get("ABSENT") ?? 0;
  const excused = byStatus.get("EXCUSED") ?? 0;
  const attTotal = present + late + absent + excused;
  const attPct = attTotal > 0 ? Math.round((present / attTotal) * 100) : null;

  return (
    <div>
      <DashboardGreeting greeting={`Hola, ${name.split(" ")[0]}`} subtitle="Esto es lo que tienes hoy en tus grupos." />

      <PendingBanner userId={userId} />

      <RevealGrid className="mt-6 grid gap-4 sm:grid-cols-4">
        <KpiCard icon={Users} label="Grupos asignados" value={gruposCount} />
        <KpiCard icon={GraduationCap} label="Alumnos activos" value={alumnosActivos} />
        <KpiCard icon={CalendarCheck} label="Clases hoy" value={clasesHoy} tone="accent" />
        <KpiCard icon={AlertTriangle} label="Alumnos en riesgo (<70)" value={enRiesgo} tone="accent" />
      </RevealGrid>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">
        Rendimiento académico de tus alumnos
      </h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <ChartCard title="Promedio por grupo">
          <BarChart data={groupAverages} />
        </ChartCard>
        <ChartCard title="Distribución de calificaciones" hint={`${grades.length} registradas`}>
          {grades.length > 0 ? (
            <ColumnChart data={buckets} />
          ) : (
            <p className="text-sm text-muted">Aún no has registrado calificaciones.</p>
          )}
        </ChartCard>
        <ChartCard title="Asistencia de tus grupos" hint="Últimos 30 días">
          {attTotal > 0 ? (
            <DonutChart
              centerLabel={attPct !== null ? `${attPct}%` : "—"}
              slices={[
                { label: "Presente", value: present, colorClass: "text-primary" },
                { label: "Tarde", value: late, colorClass: "text-amber-500" },
                { label: "Falta", value: absent, colorClass: "text-accent" },
                { label: "Justificada", value: excused, colorClass: "text-border" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">Sin registros de asistencia.</p>
          )}
        </ChartCard>
      </div>

      <h2 className="mt-8 text-sm font-semibold text-muted uppercase tracking-wide">Accesos rápidos</h2>
      <RevealGrid className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickActionTile href="/portal/horario" icon={Clock} label="Horario" description="Tus grupos y horarios de clase" />
        <QuickActionTile href="/portal/asistencia" icon={CalendarCheck} label="Asistencia" description="Pasar lista por grupo y fecha" />
        <QuickActionTile href="/portal/calificaciones" icon={GraduationCap} label="Calificaciones" description="Registrar notas y evaluaciones" />
        <QuickActionTile href="/portal/materiales" icon={BookOpen} label="Materiales" description="Compartir material con tus grupos" />
        <QuickActionTile href="/portal/incidencias" icon={AlertTriangle} label="Incidencias" description="Reportar conducta o disciplina" />
        <QuickActionTile href="/portal/solicitudes" icon={FileText} label="Solicitudes" description="Pedir una baja o cambio de grupo" />
        <QuickActionTile href="/portal/biblioteca" icon={Library} label="Biblioteca de Material" description="Solicitar acceso a material de apoyo" />
      </RevealGrid>
    </div>
  );
}
