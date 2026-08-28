import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { reviewGroupChangeRequest } from "@/app/api/admin/group-change-requests/[id]/route";
import { Table, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { GroupChangeRequestType, Role } from "@prisma/client";

const TYPE_LABELS: Record<GroupChangeRequestType, string> = {
  BAJA: "Baja",
  CAMBIO_GRUPO: "Cambio de grupo",
};

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const where =
    scope.type === "ALL"
      ? { status: "PENDIENTE" as const }
      : scope.type === "CAMPUS_LIST"
        ? { status: "PENDIENTE" as const, student: { campusId: { in: scope.campusIds } } }
        : { id: { in: [] } };

  const requests = await prisma.groupChangeRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { user: { select: { id: true, name: true } } } },
      currentGroup: true,
      requestedGroup: true,
      requestedBy: { select: { id: true, name: true } },
    },
  });

  async function review(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const id = formData.get("id")?.toString();
    const decision = formData.get("decision")?.toString();

    if (!id || (decision !== "APROBADA" && decision !== "RECHAZADA")) {
      redirect("/admin/control-escolar/solicitudes?error=Datos+inv%C3%A1lidos");
    }

    const res = await reviewGroupChangeRequest(
      session.user as { id: string; role: Role },
      id,
      decision as "APROBADA" | "RECHAZADA"
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      redirect(
        `/admin/control-escolar/solicitudes?error=${encodeURIComponent(body.error ?? "Ocurrió un error")}`
      );
    }

    revalidatePath("/admin/control-escolar/solicitudes");
    redirect("/admin/control-escolar/solicitudes");
  }

  const params = await searchParams;

  return (
    <div>
      <h1 className="text-lg font-semibold">Solicitudes de cambio de grupo</h1>
      <p className="mt-1 text-sm text-muted">Solicitudes pendientes de revisión.</p>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {params.error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-white">
        <Table>
          <thead>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Grupo actual</TableHead>
              <TableHead>Grupo solicitado</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Solicitó</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.student.user.name}</TableCell>
                <TableCell>
                  <Badge tone={request.type === "BAJA" ? "accent" : "primary"}>
                    {TYPE_LABELS[request.type]}
                  </Badge>
                </TableCell>
                <TableCell>{request.currentGroup.name}</TableCell>
                <TableCell>{request.requestedGroup?.name ?? "—"}</TableCell>
                <TableCell>{request.reason}</TableCell>
                <TableCell>{request.requestedBy.name}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <form action={review}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="decision" value="APROBADA" />
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      >
                        Aprobar
                      </button>
                    </form>
                    <form action={review}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="decision" value="RECHAZADA" />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface"
                      >
                        Rechazar
                      </button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted">
                  No hay solicitudes pendientes.
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
