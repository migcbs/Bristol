import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { reviewGroupChangeRequest } from "@/app/api/admin/group-change-requests/[id]/route";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { NewSolicitudModal } from "@/components/admin/new-solicitud-modal";
import { Check, X, ArrowRight } from "lucide-react";
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

  // This page previously had no module check at all beyond the bare
  // ADMIN/STAFF role — any puesto (even Caja or Comercial) could view the
  // pending-solicitudes queue, though the approve/reject action itself was
  // already protected inside reviewGroupChangeRequest. Fixed 2026-09-09
  // alongside wiring up the actual "who creates a solicitud" flow.
  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "solicitudes");
  if (access === "none") redirect("/admin");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const destinationGroups =
    scope.type === "ALL"
      ? await prisma.group.findMany({ select: { id: true, name: true, campusId: true }, orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.group.findMany({
            where: { campusId: { in: scope.campusIds } },
            select: { id: true, name: true, campusId: true },
            orderBy: { name: "asc" },
          })
        : [];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Solicitudes de cambio de grupo</h1>
          <p className="mt-1 text-sm text-muted">Solicitudes pendientes de revisión.</p>
        </div>
        <NewSolicitudModal destinationGroups={destinationGroups} />
      </div>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {params.error}
        </p>
      )}

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {requests.map((request) => (
          <RecordCard
            key={request.id}
            avatarId={request.student.user.id}
            avatarLabel={request.student.user.name.trim().charAt(0).toUpperCase() || "?"}
            name={request.student.user.name}
            meta={
              <>
                <span className="flex items-center gap-1">
                  {request.currentGroup.name}
                  {request.requestedGroup && (
                    <>
                      <ArrowRight size={11} /> {request.requestedGroup.name}
                    </>
                  )}
                </span>
                <span>Solicitó: {request.requestedBy.name}</span>
              </>
            }
            tags={
              <>
                <Tag tone={request.type === "BAJA" ? "red" : "blue"}>{TYPE_LABELS[request.type]}</Tag>
                <p className="w-full truncate text-xs text-muted">{request.reason}</p>
              </>
            }
            actions={
              access === "full" ? (
                <>
                  <form action={review}>
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="decision" value="APROBADA" />
                    <IconActionButton icon={Check} label="Aprobar" type="submit" />
                  </form>
                  <form action={review}>
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="decision" value="RECHAZADA" />
                    <IconActionButton icon={X} label="Rechazar" tone="danger" type="submit" />
                  </form>
                </>
              ) : undefined
            }
          />
        ))}
      </div>

      {requests.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No hay solicitudes pendientes.</p>
      )}
    </div>
  );
}
