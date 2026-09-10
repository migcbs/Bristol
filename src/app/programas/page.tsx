import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Primeros pasos: saludos, presentaciones y frases cotidianas.",
  A2: "Conversaciones simples sobre temas familiares y rutinas.",
  B1: "Independencia para viajar, trabajar y estudiar en inglés.",
  B2: "Fluidez para debatir ideas complejas con naturalidad.",
  C1: "Dominio avanzado para entornos académicos y profesionales.",
  C2: "Precisión casi nativa en cualquier contexto.",
};

export const revalidate = 3600;

export default async function ProgramasPage() {
  const levels = await prisma.level.findMany({ orderBy: { code: "asc" } });

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="bg-primary px-6 py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold tracking-wide text-white/70">
            Bristol · Inglés Profesional
          </span>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Programas por nivel
          </h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Cada nivel dura un ciclo escolar y prepara al alumno para avanzar
            con confianza al siguiente. Los grupos son reducidos y guiados por
            profesores certificados.
          </p>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <ol className="relative border-l-2 border-border pl-8">
          {levels.map((level, i) => (
            <li key={level.id} className="relative pb-12 last:pb-0">
              <span
                className="absolute -left-[calc(2.5rem+1px)] flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold text-white"
                style={{
                  background:
                    i === levels.length - 1
                      ? "var(--color-accent)"
                      : "var(--color-primary)",
                }}
              >
                {level.code}
              </span>
              <h2 className="font-display text-xl font-semibold">{level.name}</h2>
              <p className="mt-2 text-muted">{LEVEL_DESCRIPTIONS[level.code] ?? ""}</p>
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </div>
  );
}
