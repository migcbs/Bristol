import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Primeros pasos: saludos, presentaciones y frases cotidianas.",
  A2: "Conversaciones simples sobre temas familiares y rutinas.",
  B1: "Independencia para viajar, trabajar y estudiar en inglés.",
  B2: "Fluidez para debatir ideas complejas con naturalidad.",
  C1: "Dominio avanzado para entornos académicos y profesionales.",
  C2: "Precisión casi nativa en cualquier contexto.",
};

export default async function ProgramasPage() {
  const levels = await prisma.level.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold text-primary">Programas por nivel</h1>
        <p className="mt-4 max-w-2xl text-gray-600">
          Cada nivel dura un ciclo escolar y prepara al alumno para avanzar con
          confianza al siguiente. Los grupos son reducidos y guiados por
          profesores certificados.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {levels.map((level) => (
            <Card key={level.id}>
              <Badge tone="primary">{level.code}</Badge>
              <h2 className="mt-3 text-xl font-semibold">{level.name}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {LEVEL_DESCRIPTIONS[level.code] ?? ""}
              </p>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
