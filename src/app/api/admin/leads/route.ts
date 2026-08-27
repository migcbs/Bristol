import { auth } from "@/lib/auth";
import { getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { Prisma, LeadStatus } from "@prisma/client";

const VALID_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "ENROLLED", "LOST"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const where: Prisma.LeadWhereInput =
    scope.type === "ALL"
      ? {}
      : scope.type === "CAMPUS_LIST"
        ? { OR: [{ campusId: { in: scope.campusIds } }, { campusId: null }] }
        : {};

  const statusParam = new URL(request.url).searchParams.get("status");
  if (statusParam && VALID_STATUSES.includes(statusParam as LeadStatus)) {
    where.status = statusParam as LeadStatus;
  }

  const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: "desc" } });
  return Response.json(leads);
}
