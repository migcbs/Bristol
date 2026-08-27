import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { IncidentForm } from "@/components/portal/incident-form";

export default async function IncidenciasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "TEACHER") redirect("/portal");

  const userId = (session.user as { id: string }).id;

  const groups = await prisma.group.findMany({
    where: { teacherId: userId },
    include: {
      enrollments: {
        where: { completedAt: null },
        include: { student: { include: { user: true } } },
      },
    },
  });

  const students = groups.flatMap((g) =>
    g.enrollments.map((e) => ({ id: e.studentId, name: e.student.user.name, groupId: g.id }))
  );

  const incidents = await prisma.incident.findMany({
    where: { reportedById: userId },
    orderBy: { createdAt: "desc" },
    include: { student: { include: { user: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Incidencias</h1>
      <div className="mt-4">
        {students.length > 0 ? (
          <IncidentForm students={students} />
        ) : (
          <p className="text-sm text-muted">No tienes alumnos asignados.</p>
        )}
      </div>
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted">Incidencias registradas por ti</h2>
        <div className="mt-3 space-y-3">
          {incidents.map((incident) => (
            <Card key={incident.id}>
              <p className="text-sm font-medium">{incident.student.user.name}</p>
              <p className="mt-1 text-sm text-muted">{incident.description}</p>
              <p className="mt-2 text-xs text-muted">
                {incident.createdAt.toLocaleDateString("es-MX")}
              </p>
            </Card>
          ))}
          {incidents.length === 0 && (
            <p className="text-sm text-muted">Aún no has registrado incidencias.</p>
          )}
        </div>
      </div>
    </div>
  );
}
