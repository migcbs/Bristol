import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { BarChart, DonutChart, LineChart } from "@/components/ui/charts";
import type { StudentAnalytics } from "@/lib/student-analytics";

// Shared academic-progress panel for the alumno inicio and, one per child,
// the padre/tutor inicio. Grade trend, attendance split and CEFR-skill
// averages — all spanning every enrollment so a reinscripción never looks
// like a reset.
export function StudentProgressPanel({
  analytics,
  heading,
}: {
  analytics: StudentAnalytics;
  heading?: string;
}) {
  const { gradeTrend, average, attendance, skillAverages, gradeCount } = analytics;
  const hasSkills = skillAverages.some((s) => s.value > 0);

  return (
    <div>
      {heading && <h3 className="text-sm font-semibold text-text">{heading}</h3>}
      <div className={`grid gap-4 ${heading ? "mt-3" : ""} md:grid-cols-3`}>
        <ChartCard title="Tendencia de calificaciones" hint={average !== null ? `Prom. ${average}` : undefined}>
          {gradeCount >= 2 ? (
            <LineChart points={gradeTrend} format={(n) => String(n)} />
          ) : (
            <p className="text-sm text-muted">
              {gradeCount === 1 ? "Solo hay una calificación por ahora." : "Aún no hay calificaciones."}
            </p>
          )}
        </ChartCard>

        <ChartCard title="Asistencia" hint="Últimos 30 días">
          {attendance.total > 0 ? (
            <DonutChart
              centerLabel={attendance.pct !== null ? `${attendance.pct}%` : "—"}
              slices={[
                { label: "Presente", value: attendance.present, colorClass: "text-primary" },
                { label: "Tarde", value: attendance.late, colorClass: "text-amber-500" },
                { label: "Falta", value: attendance.absent, colorClass: "text-accent" },
                { label: "Justificada", value: attendance.excused, colorClass: "text-border" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">Sin registros de asistencia.</p>
          )}
        </ChartCard>

        <ChartCard title="Promedio por habilidad" hint="Evaluaciones por bloque">
          {hasSkills ? (
            <BarChart data={skillAverages} />
          ) : (
            <p className="text-sm text-muted">Aún no hay evaluaciones por bloque.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
