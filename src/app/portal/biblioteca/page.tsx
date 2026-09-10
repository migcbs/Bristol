import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequestAccessButton } from "@/components/portal/request-access-button";
import type { Role } from "@prisma/client";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Solicitud en revisión",
  APROBADA: "Acceso concedido",
  RECHAZADA: "Solicitud rechazada",
};

export default async function BibliotecaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER") redirect("/portal");

  const teacherId = (session.user as { id: string }).id;

  const carpetas = await prisma.materialCarpeta.findMany({
    orderBy: { nombre: "asc" },
    include: {
      requests: { where: { teacherId }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const approvedIds = carpetas.filter((c) => c.requests[0]?.status === "APROBADA").map((c) => c.id);
  const items = approvedIds.length
    ? await prisma.materialLibraryItem.findMany({
        where: { carpetaId: { in: approvedIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <h1 className="text-lg font-semibold">Biblioteca de Material</h1>
      <p className="mt-1 text-sm text-muted">
        Material didáctico facilitado por Control Escolar. Solicita acceso a una carpeta para ver su contenido.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {carpetas.map((carpeta) => {
          const status = carpeta.requests[0]?.status;
          const carpetaItems = items.filter((i) => i.carpetaId === carpeta.id);
          return (
            <Card key={carpeta.id}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-primary">{carpeta.nombre}</h2>
                {status && (
                  <Badge tone={status === "APROBADA" ? "primary" : status === "PENDIENTE" ? "neutral" : "accent"}>
                    {STATUS_LABEL[status]}
                  </Badge>
                )}
              </div>
              {carpeta.descripcion && <p className="mt-1 text-sm text-muted">{carpeta.descripcion}</p>}

              {status === "APROBADA" ? (
                <div className="mt-3 space-y-2">
                  {carpetaItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md border border-border px-3 py-2 text-sm text-primary underline hover:bg-surface"
                    >
                      {item.titulo}
                    </a>
                  ))}
                  {carpetaItems.length === 0 && (
                    <p className="text-xs text-muted">Esta carpeta todavía no tiene archivos.</p>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <RequestAccessButton
                    carpetaId={carpeta.id}
                    disabled={status === "PENDIENTE"}
                    label={status === "RECHAZADA" ? "Volver a solicitar" : "Solicitar acceso"}
                  />
                </div>
              )}
            </Card>
          );
        })}
        {carpetas.length === 0 && <p className="text-sm text-muted">Todavía no hay carpetas publicadas.</p>}
      </div>
    </div>
  );
}
