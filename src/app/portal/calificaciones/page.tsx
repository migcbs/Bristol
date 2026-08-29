import { auth } from "@/lib/auth";
import { getVisibleEnrollmentIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GradeForm } from "@/components/portal/grade-form";
import { BlockEvaluationForm } from "@/components/portal/block-evaluation-form";
import type { Role } from "@prisma/client";

export default async function CalificacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const enrollmentIds = await getVisibleEnrollmentIds(user);

  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    include: { student: { include: { user: { select: { id: true, name: true } } } }, group: true },
  });

  const grades = await prisma.grade.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    orderBy: { createdAt: "desc" },
  });

  const blockEvaluations = await prisma.blockEvaluation.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
    orderBy: { createdAt: "desc" },
  });

  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));

  return (
    <div>
      <h1 className="text-lg font-semibold">Calificaciones</h1>

      {role === "TEACHER" && enrollments.length > 0 && (
        <div className="mt-4">
          <GradeForm
            students={enrollments.map((e) => ({
              enrollmentId: e.id,
              name: `${e.student.user.name} (${e.group.name})`,
            }))}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {grades.map((grade) => {
          const enrollment = enrollmentById.get(grade.enrollmentId);
          return (
            <Card key={grade.id}>
              <p className="text-sm font-medium">{grade.title}</p>
              <p className="mt-1 text-sm text-muted">
                {enrollment ? `${enrollment.student.user.name} · ${enrollment.group.name}` : ""} — {grade.score}/{grade.maxScore}
              </p>
              <p className="mt-2 text-xs text-muted">{grade.createdAt.toLocaleDateString("es-MX")}</p>
            </Card>
          );
        })}
        {grades.length === 0 && <p className="text-sm text-muted">Aún no hay calificaciones registradas.</p>}
      </div>

      <h2 className="mt-8 text-base font-semibold">Evaluaciones por bloque</h2>

      {role === "TEACHER" && enrollments.length > 0 && (
        <div className="mt-4">
          <BlockEvaluationForm
            students={enrollments.map((e) => ({
              enrollmentId: e.id,
              name: `${e.student.user.name} (${e.group.name})`,
            }))}
          />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {blockEvaluations.map((evaluation) => {
          const enrollment = enrollmentById.get(evaluation.enrollmentId);
          return (
            <Card key={evaluation.id}>
              <p className="text-sm font-medium">
                {enrollment ? `${enrollment.student.user.name} · ${enrollment.group.name}` : ""} — Bloque {evaluation.bloqueNumero}
              </p>
              <p className="mt-1 text-sm text-muted">
                Listening: {evaluation.notaListening.toString()} · Speaking: {evaluation.notaSpeaking.toString()} · Reading:{" "}
                {evaluation.notaReading.toString()} · Writing: {evaluation.notaWriting.toString()} · Grammar:{" "}
                {evaluation.notaGrammar.toString()}
              </p>
              <p className="mt-1 text-sm text-muted">Promedio: {evaluation.promedioBloque.toString()}</p>
              <p className="mt-2 text-xs text-muted">{evaluation.createdAt.toLocaleDateString("es-MX")}</p>
            </Card>
          );
        })}
        {blockEvaluations.length === 0 && (
          <p className="text-sm text-muted">Aún no hay evaluaciones por bloque registradas.</p>
        )}
      </div>
    </div>
  );
}
