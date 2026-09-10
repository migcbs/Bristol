import { prisma } from "@/lib/prisma";

export interface StudentAnalytics {
  gradeCount: number;
  gradeTrend: number[]; // each 0–100, chronological
  average: number | null; // 0–100
  attendance: { present: number; absent: number; late: number; excused: number; total: number; pct: number | null };
  skillAverages: { label: string; value: number }[]; // 0–100 per CEFR skill
}

const SKILLS: { key: "notaListening" | "notaSpeaking" | "notaReading" | "notaWriting" | "notaGrammar"; label: string }[] = [
  { key: "notaListening", label: "Listening" },
  { key: "notaSpeaking", label: "Speaking" },
  { key: "notaReading", label: "Reading" },
  { key: "notaWriting", label: "Writing" },
  { key: "notaGrammar", label: "Grammar" },
];

// Academic analytics for one student, spanning ALL their enrollments so a
// reinscripción never appears to reset progress. Used by the student
// inicio and, per child, by the parent inicio (2026-09-09 request for
// "el avance del alumno / el avance de los hijos").
export async function getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
  const enrollmentIds = (
    await prisma.enrollment.findMany({ where: { studentId }, select: { id: true } })
  ).map((r) => r.id);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [grades, attendanceRows, blockEvals] = await Promise.all([
    prisma.grade.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      orderBy: { createdAt: "asc" },
      select: { score: true, maxScore: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { enrollmentId: { in: enrollmentIds }, date: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.blockEvaluation.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      select: { notaListening: true, notaSpeaking: true, notaReading: true, notaWriting: true, notaGrammar: true },
    }),
  ]);

  const gradeTrend = grades.map((g) => Math.round((g.score / (g.maxScore || 100)) * 100));
  const average =
    gradeTrend.length > 0 ? Math.round(gradeTrend.reduce((a, b) => a + b, 0) / gradeTrend.length) : null;

  const byStatus = new Map(attendanceRows.map((r) => [r.status, r._count._all]));
  const present = byStatus.get("PRESENT") ?? 0;
  const absent = byStatus.get("ABSENT") ?? 0;
  const late = byStatus.get("LATE") ?? 0;
  const excused = byStatus.get("EXCUSED") ?? 0;
  const total = present + absent + late + excused;
  // Present-only, to match the "Asistencia (30 días)" KPI shown elsewhere
  // on the same dashboards. LATE/EXCUSED are still visible in the donut
  // breakdown.
  const pct = total > 0 ? Math.round((present / total) * 100) : null;

  const skillAverages = SKILLS.map(({ key, label }) => {
    if (blockEvals.length === 0) return { label, value: 0 };
    // Block skill scores are already on a 0–100 scale (see
    // /api/admin/block-evaluations validation).
    const sum = blockEvals.reduce((acc, e) => acc + Number(e[key]), 0);
    return { label, value: Math.round(sum / blockEvals.length) };
  });

  return {
    gradeCount: grades.length,
    gradeTrend,
    average,
    attendance: { present, absent, late, excused, total, pct },
    skillAverages,
  };
}
