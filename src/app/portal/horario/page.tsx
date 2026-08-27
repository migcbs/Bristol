import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ScheduleForm } from "@/components/portal/schedule-form";
import type { Role } from "@prisma/client";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

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
        <p className="mt-2 text-sm text-muted">No hay grupos disponibles.</p>
      </div>
    );
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = groups.some((g) => g.id === params.groupId) ? params.groupId! : groups[0].id;

  const slots = await prisma.scheduleSlot.findMany({
    where: { groupId: selectedGroupId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Horario</h1>
      <form method="get" className="mt-4">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="ml-2 rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {slots.length > 0 ? (
          slots.map((slot) => (
            <Card key={slot.id}>
              <p className="text-sm font-medium">
                {DAY_LABELS[slot.dayOfWeek]} · {slot.startTime}–{slot.endTime}
              </p>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted">Este grupo aún no tiene horario publicado.</p>
        )}
      </div>

      {role === "TEACHER" && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Editar horario</h2>
          <div className="mt-3">
            <ScheduleForm
              key={selectedGroupId}
              groupId={selectedGroupId}
              initialSlots={slots.map((s) => ({
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
