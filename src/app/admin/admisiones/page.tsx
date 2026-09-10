import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampusScope, leadScopeWhere } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import { AdmisionesBoard, type AdmisionesFilter } from "@/components/admin/admisiones-board";

const VALID_FILTERS: AdmisionesFilter[] = ["activos", "todos", "NEW", "CONTACTED", "PLACEMENT_SCHEDULED", "ENROLLED", "LOST"];

export default async function AdmisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: string }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: any });

  const where = leadScopeWhere(scope);

  const [leads, campuses, staff] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { campus: true } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const { filter } = await searchParams;
  const initialFilter = VALID_FILTERS.includes(filter as AdmisionesFilter) ? (filter as AdmisionesFilter) : undefined;

  return (
    <div>
      <h1 className="text-lg font-semibold">Admisiones</h1>
      <p className="mt-1 text-sm text-muted">
        Leads capturados desde la landing — rechaza, turna a otra área o inscribe directamente.
      </p>

      <div className="mt-6">
        <AdmisionesBoard leads={leads} campuses={campuses} advisors={staff} allStaff={staff} initialFilter={initialFilter} />
      </div>
    </div>
  );
}
