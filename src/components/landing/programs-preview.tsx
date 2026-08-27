"use client";

import { useRef } from "react";
import type { Level } from "@prisma/client";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: "Primeros pasos: saludos, presentaciones y frases cotidianas.",
  A2: "Conversaciones simples sobre temas familiares y rutinas.",
  B1: "Independencia para viajar, trabajar y estudiar en inglés.",
  B2: "Fluidez para debatir ideas complejas con naturalidad.",
  C1: "Dominio avanzado para entornos académicos y profesionales.",
  C2: "Precisión casi nativa en cualquier contexto.",
};

function LevelCard({ level }: { level: Level }) {
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-[2.5rem] border border-border bg-white p-8 shadow-[0_1px_2px_rgba(20,20,43,0.04),0_24px_48px_-24px_rgba(20,20,43,0.28)] sm:p-10">
      <div className="flex items-start justify-between">
        <Badge tone="primary">{level.code}</Badge>
        <span className="font-display text-6xl font-bold text-border sm:text-7xl">
          {level.code}
        </span>
      </div>
      <div>
        <h3 className="font-display text-3xl font-bold text-primary sm:text-4xl">
          {level.name}
        </h3>
        <p className="mt-3 max-w-md text-muted">{LEVEL_DESCRIPTIONS[level.code] ?? ""}</p>
      </div>
    </div>
  );
}

function StackCard({
  level,
  index,
  total,
}: {
  level: Level;
  index: number;
  total: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start start", "end start"],
  });

  const targetScale = 1 - (total - 1 - index) * 0.05;
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [1, 1] : [1, targetScale]
  );

  return (
    <div ref={cardRef} className="h-[65vh] sm:h-[70vh]">
      <div
        className="sticky flex h-[65vh] items-center justify-center sm:h-[70vh]"
        style={{ top: `${96 + index * 16}px` }}
      >
        <motion.div style={{ scale }} className="h-full w-full max-w-2xl origin-top">
          <LevelCard level={level} />
        </motion.div>
      </div>
    </div>
  );
}

function StaticStack({ levels }: { levels: Level[] }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
      {levels.map((level) => (
        <div key={level.id} className="h-64">
          <LevelCard level={level} />
        </div>
      ))}
    </div>
  );
}

export function ProgramsPreview({ levels }: { levels: Level[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <Section id="programas">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-primary md:text-4xl">
          Un camino claro, nivel por nivel
        </h2>
        <p className="mt-3 text-muted">
          Seis niveles alineados al Marco Común Europeo de Referencia (CEFR).
          Desliza para ver cómo avanza cada nivel.
        </p>
      </div>

      {shouldReduceMotion ? (
        <div className="mt-12">
          <StaticStack levels={levels} />
        </div>
      ) : (
        <div className="mx-auto mt-16 max-w-2xl px-6">
          {levels.map((level, i) => (
            <StackCard key={level.id} level={level} index={i} total={levels.length} />
          ))}
        </div>
      )}

      <div className="px-6 pb-4 pt-8 text-center">
        <a href="/programas">
          <Button variant="outline">Ver todos los niveles</Button>
        </a>
      </div>
    </Section>
  );
}
