import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScheduleForm } from "@/components/portal/schedule-form";
import { WeekSchedule, type ScheduleBlock } from "@/components/ui/week-schedule";
import type { Role } from "@prisma/client";

// Weekly class schedule as a calendar, per the user's 2026-09-09 request.
// Teachers and students see every group they're tied to at once; a parent
// sees all their enrolled children together, one colour per child.
export default async function HorarioPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const groupIds = await getVisibleGroupIds(user);

  if (groupIds.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Horario</h1>
        <p className="mt-2 text-sm text-muted">No hay grupos con horario disponible.</p>
      </div>
    );
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: { level: true, scheduleSlots: true, teacher: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  // For a parent, map each group to the child enrolled in it so blocks
  // can be coloured and labelled per child.
  let childByGroup = new Map<string, string>();
  if (role === "PARENT") {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        completedAt: null,
        groupId: { in: groupIds },
        student: { parentLinks: { some: { parentUserId: user.id } } },
      },
      include: { student: { include: { user: { select: { name: true } } } } },
    });
    childByGroup = new Map(enrollments.map((e) => [e.groupId, e.student.user.name]));
  }

  const blocks: ScheduleBlock[] = groups.flatMap((g) => {
    const groupLabel = `${g.level.code} · ${g.name}`;
    const child = childByGroup.get(g.id);
    return g.scheduleSlots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      label: role === "PARENT" ? (child ?? groupLabel) : groupLabel,
      sublabel: role === "PARENT" ? groupLabel : role === "STUDENT" ? g.teacher.name : undefined,
      colorKey: role === "PARENT" ? (child ?? g.id) : g.id,
    }));
  });

  const legend =
    role === "PARENT"
      ? [...new Set([...childByGroup.values()])].map((name) => ({ label: name, colorKey: name }))
      : groups.map((g) => ({ label: `${g.level.code} · ${g.name}`, colorKey: g.id }));

  // Teachers keep the per-group editor below the calendar.
  const params = await searchParams;
  const selectedGroupId = groups.some((g) => g.id === params.groupId) ? params.groupId! : groups[0].id;
  const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;

  return (
    <div>
      <h1 className="text-lg font-semibold">Horario</h1>
      <p className="mt-1 text-sm text-muted">
        {role === "PARENT"
          ? "Clases de tus hijos esta semana. Cada color es un hijo."
          : "Tus clases de la semana."}
      </p>

      <div className="mt-6">
        <WeekSchedule blocks={blocks} legend={legend} />
      </div>

      {role === "TEACHER" && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Editar horario</h2>
          <form method="get" className="mt-3">
            <select
              name="groupId"
              defaultValue={selectedGroupId}
              className="rounded-md border border-border px-2 py-1 text-sm"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.level.code} · {g.name}
                </option>
              ))}
            </select>
            <button type="submit" className="ml-2 rounded-md border border-border px-3 py-1 text-sm">
              Seleccionar
            </button>
          </form>
          <div className="mt-3">
            <ScheduleForm
              key={selectedGroupId}
              groupId={selectedGroupId}
              initialSlots={selectedGroup.scheduleSlots.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
