import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AttendanceForm } from "@/components/portal/attendance-form";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") redirect("/portal");

  const userId = (session.user as { id: string }).id;
  const groups = await prisma.group.findMany({
    where: { teacherId: userId },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = params.groupId ?? groups[0]?.id;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  if (!selectedGroupId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Asistencia</h1>
        <p className="mt-2 text-sm text-muted">No tienes grupos asignados.</p>
      </div>
    );
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { groupId: selectedGroupId, completedAt: null },
    include: { student: { include: { user: true } } },
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { date: new Date(date), enrollment: { groupId: selectedGroupId } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Asistencia</h1>
      <form method="get" className="mt-4 flex flex-wrap gap-3">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-md border border-border px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      <div className="mt-6">
        {existing.length > 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Ya existe asistencia guardada para esta fecha. Los registros de asistencia son
              definitivos y no se pueden modificar.
            </p>
          </Card>
        ) : (
          <AttendanceForm
            groupId={selectedGroupId}
            date={date}
            students={enrollments.map((e) => ({
              enrollmentId: e.id,
              name: e.student.user.name,
            }))}
          />
        )}
      </div>
    </div>
  );
}
