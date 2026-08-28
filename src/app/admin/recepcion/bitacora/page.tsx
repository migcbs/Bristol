import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertCampusInScope, getCampusScope } from "@/lib/campus-scope";
import { prisma } from "@/lib/prisma";
import type { ReceptionLogType, Role } from "@prisma/client";

const VALID_TYPES: ReceptionLogType[] = ["LLAMADA", "INCIDENCIA", "NOTA"];
const MAX_NOTE_LENGTH = 2000;

const TYPE_LABELS: Record<ReceptionLogType, string> = {
  LLAMADA: "Llamada",
  INCIDENCIA: "Incidencia",
  NOTA: "Nota",
};

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; altas?: string; bajas?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role: Role }).role;
  if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

  const scope = await getCampusScope(session.user as { id: string; role: Role });
  const campusWhere =
    scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [entries, campuses] = await Promise.all([
    prisma.receptionLogEntry.findMany({
      where: { ...campusWhere, createdAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    scope.type === "ALL"
      ? prisma.campus.findMany({ orderBy: { name: "asc" } })
      : prisma.campus.findMany({
          where: scope.type === "CAMPUS_LIST" ? { id: { in: scope.campusIds } } : { id: { in: [] } },
          orderBy: { name: "asc" },
        }),
  ]);

  async function addEntry(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const campusId = formData.get("campusId")?.toString();
    const type = formData.get("type")?.toString();
    const note = formData.get("note")?.toString().trim();

    if (!campusId || !type || !VALID_TYPES.includes(type as ReceptionLogType) || !note || note.length > MAX_NOTE_LENGTH) {
      redirect("/admin/recepcion/bitacora?error=Datos+inv%C3%A1lidos");
    }

    if (role === "STAFF") {
      const inScope = await assertCampusInScope(session.user as { id: string; role: Role }, campusId);
      if (!inScope) {
        redirect("/admin/recepcion/bitacora?error=No+autorizado");
      }
    }

    await prisma.receptionLogEntry.create({
      data: {
        campusId,
        type: type as ReceptionLogType,
        note,
        createdById: (session.user as { id: string }).id,
      },
    });

    revalidatePath("/admin/recepcion/bitacora");
    redirect("/admin/recepcion/bitacora");
  }

  async function generateMonthlyReport() {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const scope = await getCampusScope(session.user as { id: string; role: Role });
    const reportCampusWhere =
      scope.type === "ALL" ? {} : scope.type === "CAMPUS_LIST" ? { campusId: { in: scope.campusIds } } : { id: { in: [] } };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [altas, bajas] = await Promise.all([
      prisma.lead.count({
        where: { ...reportCampusWhere, status: "ENROLLED", createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.student.count({
        where: { ...reportCampusWhere, estatusAlumno: "BAJA", createdAt: { gte: monthStart, lt: monthEnd } },
      }),
    ]);

    redirect(`/admin/recepcion/bitacora?altas=${altas}&bajas=${bajas}`);
  }

  const params = await searchParams;

  return (
    <div>
      <h1 className="text-lg font-semibold">Bitácora</h1>
      <p className="mt-1 text-sm text-muted">Registro de recepción del día de hoy.</p>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {params.error}
        </p>
      )}

      {(params.altas !== undefined || params.bajas !== undefined) && (
        <div className="mt-4 rounded-md border border-primary bg-primary/10 px-4 py-3 text-sm">
          <p className="font-semibold">Reporte mensual</p>
          <p className="mt-1 text-muted">
            Altas: <span className="font-medium text-foreground">{params.altas ?? 0}</span> · Bajas:{" "}
            <span className="font-medium text-foreground">{params.bajas ?? 0}</span>
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start gap-6">
        <form action={addEntry} className="flex flex-1 min-w-[280px] flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-3">
            <select
              name="campusId"
              required
              aria-label="Plantel"
              className="rounded-md border border-border px-2 py-1.5 text-sm"
            >
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
            <select name="type" required aria-label="Tipo" className="rounded-md border border-border px-2 py-1.5 text-sm">
              {VALID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="note"
            required
            placeholder="Nota..."
            maxLength={MAX_NOTE_LENGTH}
            className="min-h-[80px] rounded-md border border-border px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Agregar
          </button>
        </form>

        <form action={generateMonthlyReport}>
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Generar reporte mensual
          </button>
        </form>
      </div>

      <div className="mt-8 space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-md border border-border bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{TYPE_LABELS[entry.type]}</span>
              <span className="text-xs text-muted">{entry.createdAt.toLocaleString("es-MX")}</span>
            </div>
            <p className="mt-1 text-muted">{entry.note}</p>
            <p className="mt-1 text-xs text-muted">Por {entry.createdBy.name}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted">No hay registros de bitácora hoy.</p>
        )}
      </div>
    </div>
  );
}
