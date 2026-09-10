import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { reviewTestimonial } from "@/app/api/admin/testimonials/[id]/route";
import { RecordCard } from "@/components/ui/record-card";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Check, X } from "lucide-react";
import { ResenasAccessModal } from "@/components/admin/resenas-access-modal";
import type { Role } from "@prisma/client";

export default async function ResenasPage({
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

  const access = await hasModuleAccess(session.user as { id: string; role: Role }, "resenas");
  if (access === "none") redirect("/admin");
  const canModerate = access === "full";

  const pending = await prisma.testimonial.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  const staffAccounts =
    role === "ADMIN"
      ? (
          await prisma.user.findMany({
            where: { role: "STAFF" },
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true, staffPosition: true, extraModuleAccess: true },
          })
        ).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          staffPosition: u.staffPosition,
          hasAccess: u.extraModuleAccess.includes("resenas"),
        }))
      : [];

  async function review(formData: FormData) {
    "use server";

    const session = await auth();
    if (!session?.user) redirect("/login");
    const role = (session.user as { role: Role }).role;
    if (role !== "ADMIN" && role !== "STAFF") redirect("/portal");

    const id = formData.get("id")?.toString();
    const decision = formData.get("decision")?.toString();

    if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) {
      redirect("/admin/comunicaciones/resenas?error=Datos+inv%C3%A1lidos");
    }

    const res = await reviewTestimonial(
      session.user as { id: string; role: Role },
      id,
      decision as "APPROVED" | "REJECTED"
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      redirect(`/admin/comunicaciones/resenas?error=${encodeURIComponent(body.error ?? "Ocurrió un error")}`);
    }

    revalidatePath("/admin/comunicaciones/resenas");
    revalidatePath("/");
    redirect("/admin/comunicaciones/resenas");
  }

  const params = await searchParams;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Reseñas del sitio</h1>
          <p className="mt-1 text-sm text-muted">
            Reseñas enviadas desde la landing, pendientes de revisión antes de publicarse.
          </p>
        </div>
        {role === "ADMIN" && <ResenasAccessModal staff={staffAccounts} />}
      </div>

      {params.error && (
        <p className="mt-4 rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-accent-dark">
          {params.error}
        </p>
      )}

      <div className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {pending.map((testimonial) => (
          <RecordCard
            key={testimonial.id}
            avatarId={testimonial.id}
            avatarLabel={testimonial.name.trim().charAt(0).toUpperCase() || "?"}
            name={testimonial.name}
            meta={
              <>
                {testimonial.role && <span>{testimonial.role}</span>}
                <span>{testimonial.createdAt.toLocaleDateString("es-MX")}</span>
              </>
            }
            tags={
              <p className="w-full rounded-md bg-surface px-2 py-1 text-xs text-text italic">
                “{testimonial.quote}”
              </p>
            }
            actions={
              canModerate && (
                <>
                  <form action={review}>
                    <input type="hidden" name="id" value={testimonial.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <IconActionButton icon={Check} label="Aprobar" type="submit" />
                  </form>
                  <form action={review}>
                    <input type="hidden" name="id" value={testimonial.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <IconActionButton icon={X} label="Rechazar" tone="danger" type="submit" />
                  </form>
                </>
              )
            }
          />
        ))}
      </div>

      {pending.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">No hay reseñas pendientes.</p>
      )}
    </div>
  );
}
