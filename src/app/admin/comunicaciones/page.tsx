import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { announcementAdminListWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { WhatsAppAnnouncementButton } from "@/components/admin/whatsapp-announcement-button";
import type { Role } from "@prisma/client";

export default async function ComunicacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const isAdmin = role === "ADMIN";
  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campuses =
    scope.type === "ALL"
      ? await prisma.campus.findMany({ orderBy: { name: "asc" } })
      : scope.type === "CAMPUS_LIST"
        ? await prisma.campus.findMany({ where: { id: { in: scope.campusIds } }, orderBy: { name: "asc" } })
        : [];

  const where = announcementAdminListWhere({ id: (session.user as { id: string }).id, role });

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } }, campus: true },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Comunicaciones</h1>
      <div className="mt-4">
        <AnnouncementForm isAdmin={isAdmin} campuses={campuses} />
      </div>
      <div className="mt-8 space-y-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{a.title}</p>
              <WhatsAppAnnouncementButton announcementId={a.id} />
            </div>
            <p className="mt-1 text-sm text-muted">{a.body}</p>
            <p className="mt-2 text-xs text-muted">
              {a.audience === "ALL" && "Toda la escuela"}
              {a.audience === "CAMPUS" && a.campus?.name}
              {a.audience === "ROLE" && a.role}
              {" · "}
              {a.createdBy.name} · {a.createdAt.toLocaleDateString("es-MX")}
            </p>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-muted">Aún no hay anuncios.</p>
        )}
      </div>
    </div>
  );
}
