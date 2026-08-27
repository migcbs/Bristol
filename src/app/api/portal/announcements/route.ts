import { auth } from "@/lib/auth";
import { getRecipientCampusIds, announcementAudienceWhere } from "@/lib/announcement-scope";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const user = { id: (session.user as { id: string }).id, role };
  const campusIds = await getRecipientCampusIds(user);
  const where = announcementAudienceWhere({ role }, campusIds);

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return Response.json(announcements);
}
