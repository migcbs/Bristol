import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Card } from "@/components/ui/card";

export const revalidate = 3600;

export default async function PlantelesPage() {
  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="bg-primary px-6 py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Nuestros planteles
          </h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Todos nuestros planteles cuentan con salones equipados y horarios
            flexibles para adaptarse a tu rutina.
          </p>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {campuses.map((campus) => (
            <Card key={campus.id}>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent"
                aria-hidden
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
              </span>
              <h2 className="mt-4 font-display text-xl font-semibold">{campus.name}</h2>
              <p className="mt-2 text-sm text-muted">
                {campus.address ?? "Dirección próximamente"}
              </p>
              <p className="mt-4 text-sm text-muted">
                Horario: Lunes a sábado, 8:00–20:00 (referencia)
              </p>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
