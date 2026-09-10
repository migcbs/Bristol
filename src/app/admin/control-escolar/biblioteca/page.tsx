import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { CarpetaModal } from "@/components/admin/carpeta-modal";
import { CarpetaCard } from "@/components/admin/carpeta-card";
import { MaterialRequestActions } from "@/components/admin/material-request-actions";
import type { Role } from "@prisma/client";

export default async function BibliotecaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "biblioteca_material");
  if (access !== "full") redirect("/admin");

  const [carpetas, pendingRequests] = await Promise.all([
    prisma.materialCarpeta.findMany({
      orderBy: { nombre: "asc" },
      include: {
        createdBy: { select: { name: true } },
        items: { orderBy: { createdAt: "desc" }, select: { id: true, titulo: true, url: true, descripcion: true } },
        requests: { where: { status: "PENDIENTE" }, select: { id: true } },
      },
    }),
    prisma.materialAccessRequest.findMany({
      where: { status: "PENDIENTE" },
      orderBy: { createdAt: "asc" },
      include: {
        carpeta: { select: { id: true, nombre: true } },
        teacher: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Biblioteca de Material</h1>
          <p className="mt-1 text-sm text-muted">
            Material didáctico para maestros, organizado en carpetas. El acceso a cada carpeta requiere autorización.
          </p>
        </div>
        <CarpetaModal />
      </div>

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {carpetas.map((carpeta) => (
          <CarpetaCard
            key={carpeta.id}
            carpetaId={carpeta.id}
            carpetaNombre={carpeta.nombre}
            descripcion={carpeta.descripcion}
            createdByName={carpeta.createdBy.name}
            pendingRequestCount={carpeta.requests.length}
            items={carpeta.items}
            isAdmin={role === "ADMIN"}
          />
        ))}
      </div>
      {carpetas.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No hay carpetas creadas todavía.</p>
      )}

      <h2 className="mt-10 text-base font-semibold">Solicitudes de acceso pendientes</h2>
      <div className="mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {pendingRequests.map((req) => (
          <RecordCard
            key={req.id}
            avatarId={req.teacher.id}
            avatarLabel={req.teacher.name.trim().charAt(0).toUpperCase() || "?"}
            name={req.teacher.name}
            meta={<span className="truncate">{req.teacher.email}</span>}
            tags={
              <>
                <Tag tone="purple">{req.carpeta.nombre}</Tag>
                {req.motivo && <p className="w-full truncate text-xs text-muted">{req.motivo}</p>}
              </>
            }
            actions={<MaterialRequestActions requestId={req.id} />}
          />
        ))}
      </div>
      {pendingRequests.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No hay solicitudes pendientes.</p>
      )}
    </div>
  );
}
