import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RecordCard } from "@/components/ui/record-card";
import { Tag } from "@/components/ui/tag";
import { Calendar } from "lucide-react";
import type { Role, TicketStatus } from "@prisma/client";

const VALID_STATUSES: TicketStatus[] = ["ABIERTO", "EN_PROCESO", "RESUELTO"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

const STATUS_LABELS: Record<TicketStatus, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  RESUELTO: "Resuelto",
};

const STATUS_TAG_TONE: Record<TicketStatus, "red" | "amber" | "green"> = {
  ABIERTO: "red",
  EN_PROCESO: "amber",
  RESUELTO: "green",
};

export default async function TicketsPage({
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

  const [tickets, assignees] = await Promise.all([
    prisma.interAreaTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  async function createTicket(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const title = formData.get("title")?.toString().trim();
    const description = formData.get("description")?.toString().trim();
    const assignedToId = formData.get("assignedToId")?.toString();

    if (!title || title.length > MAX_TITLE_LENGTH || !description || description.length > MAX_DESCRIPTION_LENGTH) {
      redirect("/admin/tickets?error=Datos+inv%C3%A1lidos");
    }

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) {
        redirect("/admin/tickets?error=Usuario+asignado+inv%C3%A1lido");
      }
    }

    await prisma.interAreaTicket.create({
      data: {
        title,
        description,
        assignedToId: assignedToId || null,
        createdById: (session.user as { id: string }).id,
      },
    });

    revalidatePath("/admin/tickets");
    redirect("/admin/tickets");
  }

  async function updateTicket(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const id = formData.get("id")?.toString();
    const status = formData.get("status")?.toString();
    const assignedToId = formData.get("assignedToId")?.toString();

    if (!id || !status || !VALID_STATUSES.includes(status as TicketStatus)) {
      redirect("/admin/tickets?error=Datos+inv%C3%A1lidos");
    }

    const ticket = await prisma.interAreaTicket.findUnique({ where: { id } });
    if (!ticket) {
      redirect("/admin/tickets?error=No+encontrado");
    }

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) {
        redirect("/admin/tickets?error=Usuario+asignado+inv%C3%A1lido");
      }
    }

    await prisma.interAreaTicket.update({
      where: { id },
      data: {
        status: status as TicketStatus,
        resolvedAt: status === "RESUELTO" ? new Date() : null,
        assignedToId: assignedToId || null,
      },
    });

    revalidatePath("/admin/tickets");
    redirect("/admin/tickets");
  }

  const params = await searchParams;

  return (
    <div>
      <h1 className="text-lg font-semibold">Tickets</h1>
      <p className="mt-1 text-sm text-muted">Solicitudes entre áreas.</p>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {params.error}
        </p>
      )}

      <form
        action={createTicket}
        className="mt-6 flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <input
          name="title"
          required
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Título"
          aria-label="Título"
          className="min-w-[200px] flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
        />
        <textarea
          name="description"
          required
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Descripción"
          aria-label="Descripción"
          className="min-h-[38px] min-w-[240px] flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
        />
        <select name="assignedToId" aria-label="Asignado a" className="rounded-md border border-border px-2 py-1.5 text-sm">
          <option value="">Sin asignar</option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Crear ticket
        </button>
      </form>

      <div className="mt-8 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => (
          <RecordCard
            key={ticket.id}
            avatarId={ticket.id}
            avatarLabel={ticket.title.trim().charAt(0).toUpperCase() || "?"}
            name={ticket.title}
            meta={
              <>
                <span className="truncate">{ticket.description}</span>
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {ticket.createdAt.toLocaleDateString("es-MX")}
                </span>
                <span>{ticket.assignedTo?.name ?? "Sin asignar"}</span>
              </>
            }
            tags={
              <>
                <Tag tone={STATUS_TAG_TONE[ticket.status]}>{STATUS_LABELS[ticket.status]}</Tag>
                <form action={updateTicket} className="mt-1 flex w-full flex-wrap items-center gap-1.5">
                  <input type="hidden" name="id" value={ticket.id} />
                  <select
                    name="status"
                    defaultValue={ticket.status}
                    aria-label="Estatus"
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    {VALID_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    name="assignedToId"
                    defaultValue={ticket.assignedToId ?? ""}
                    aria-label="Asignado a"
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <option value="">Sin asignar</option>
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface"
                  >
                    Actualizar
                  </button>
                </form>
              </>
            }
          />
        ))}
      </div>
      {tickets.length === 0 && <p className="mt-6 text-center text-sm text-muted">No hay tickets todavía.</p>}
    </div>
  );
}
