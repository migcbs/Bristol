"use client";

import type { Level } from "@prisma/client";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Primeros pasos: saludos, presentaciones y frases cotidianas.",
  A2: "Conversaciones simples sobre temas familiares y rutinas.",
  B1: "Independencia para viajar, trabajar y estudiar en inglés.",
  B2: "Fluidez para debatir ideas complejas con naturalidad.",
  C1: "Dominio avanzado para entornos académicos y profesionales.",
  C2: "Precisión casi nativa en cualquier contexto.",
};

export function ProgramsPreview({ levels }: { levels: Level[] }) {
  return (
    <Section id="programas">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold text-primary md:text-4xl">
          Un camino claro, nivel por nivel
        </h2>
        <p className="mt-3 text-muted">
          Seis niveles alineados al Marco Común Europeo de Referencia (CEFR).
          Cada uno te prepara para avanzar con confianza al siguiente.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-4xl items-end justify-between gap-2 md:gap-4">
        {levels.map((level, i) => (
          <div
            key={level.id}
            tabIndex={0}
            aria-label={`Nivel ${level.code}: ${level.name}`}
            className="group flex flex-1 flex-col items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <p className="hidden max-w-[7rem] text-center text-xs text-muted transition-opacity duration-200 md:block md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:text-sm">
              {LEVEL_DESCRIPTIONS[level.code] ?? ""}
            </p>
            <div
              className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-110"
              style={{
                height: `${56 + i * 26}px`,
                background:
                  i === levels.length - 1
                    ? "var(--color-accent)"
                    : `color-mix(in srgb, var(--color-primary) ${30 + (i / Math.max(levels.length - 1, 1)) * 56}%, white)`,
              }}
            />
            <span className="font-display text-sm font-bold text-primary">{level.code}</span>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <a href="/programas">
          <Button variant="outline">Ver todos los niveles</Button>
        </a>
      </div>
    </Section>
  );
}
