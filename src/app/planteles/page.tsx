import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Card } from "@/components/ui/card";

export default async function PlantelesPage() {
  const campuses = await prisma.campus.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-primary">Nuestros planteles</h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          Todos nuestros planteles cuentan con salones equipados y horarios
          flexibles para adaptarse a tu rutina.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {campuses.map((campus) => (
            <Card key={campus.id}>
              <h2 className="text-xl font-semibold">{campus.name}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {campus.address ?? "Dirección próximamente"}
              </p>
              <p className="mt-4 text-sm text-gray-500">
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
