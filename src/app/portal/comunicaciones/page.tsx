import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Role } from "@prisma/client";

export default async function PortalComunicacionesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const campusIds = await getRecipientCampusIds(user);
  const where = announcementAudienceWhere({ role }, campusIds);

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Comunicaciones</h1>
      <div className="mt-6 space-y-3">
        {announcements.map((a) => (
          <Card key={a.id}>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="mt-1 text-sm text-muted">{a.body}</p>
            <p className="mt-2 text-xs text-muted">{a.createdAt.toLocaleDateString("es-MX")}</p>
          </Card>
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-muted">No hay anuncios por el momento.</p>
        )}
      </div>
    </div>
  );
}
