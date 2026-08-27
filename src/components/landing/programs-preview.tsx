"use client";

import type { Level } from "@prisma/client";
import { Section } from "@/components/ui/section";
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

export function ProgramsPreview({ levels }: { levels: Level[] }) {
  const featured = levels.slice(0, 3);

  return (
    <Section id="programas">
      <h2 className="text-center text-3xl font-bold text-primary">Nuestros programas</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
        Seis niveles alineados al Marco Común Europeo de Referencia (CEFR).
      </p>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
        {featured.map((level) => (
          <Card key={level.id}>
            <Badge tone="primary">{level.code}</Badge>
            <h3 className="mt-3 text-lg font-semibold">{level.name}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {LEVEL_DESCRIPTIONS[level.code] ?? ""}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-8 text-center">
        <a href="/programas" className="font-medium text-primary hover:underline">
          Ver todos los niveles →
        </a>
      </div>
    </Section>
  );
}
