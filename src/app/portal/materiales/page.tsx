import { auth } from "@/lib/auth";
import { getVisibleGroupIds } from "@/lib/academic-access";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MaterialForm } from "@/components/portal/material-form";
import type { Role } from "@prisma/client";

export default async function MaterialesPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: Role }).role;
  if (role !== "TEACHER" && role !== "STUDENT" && role !== "PARENT") redirect("/admin");

  const user = { id: (session.user as { id: string }).id, role };
  const groupIds = await getVisibleGroupIds(user);

  if (groupIds.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Materiales</h1>
        <p className="mt-2 text-sm text-muted">No hay grupos disponibles.</p>
      </div>
    );
  }

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;
  const selectedGroupId = groups.some((g) => g.id === params.groupId) ? params.groupId! : groups[0].id;

  const materials = await prisma.material.findMany({
    where: { groupId: selectedGroupId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return (
    <div>
      <h1 className="text-lg font-semibold">Materiales</h1>
      <form method="get" className="mt-4">
        <select name="groupId" defaultValue={selectedGroupId} className="rounded-md border border-border px-2 py-1 text-sm">
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.level.code} · {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="ml-2 rounded-md border border-border px-3 py-1 text-sm">
          Ver
        </button>
      </form>

      {role === "TEACHER" && (
        <div className="mt-6">
          <MaterialForm groupId={selectedGroupId} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {materials.map((m) => (
          <Card key={m.id}>
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
              {m.title}
            </a>
            {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
            <p className="mt-2 text-xs text-muted">
              {m.uploadedBy.name} · {m.createdAt.toLocaleDateString("es-MX")}
            </p>
          </Card>
        ))}
        {materials.length === 0 && <p className="text-sm text-muted">Este grupo aún no tiene material publicado.</p>}
      </div>
    </div>
  );
}
