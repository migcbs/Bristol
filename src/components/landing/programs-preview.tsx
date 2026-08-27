"use client";

import { useRef } from "react";
import type { Level } from "@prisma/client";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import { Card } from "@/components/ui/card";
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
    <Card className="flex h-full w-full flex-col justify-between">
      <div>
        <Badge tone="primary">{level.code}</Badge>
        <h3 className="mt-4 font-display text-3xl font-bold text-primary">{level.name}</h3>
      </div>
      <p className="text-base text-muted">{LEVEL_DESCRIPTIONS[level.code] ?? ""}</p>
    </Card>
  );
}

function StackCard({
  level,
  index,
  total,
  scrollYProgress,
}: {
  level: Level;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}) {
  const isLast = index === total - 1;
  const segment = 1 / total;
  const start = index * segment;
  const end = start + segment;

  const rotate = useTransform(scrollYProgress, [start, end], isLast ? [0, 0] : [0, -10]);
  const y = useTransform(scrollYProgress, [start, end], isLast ? [0, 0] : [0, -60]);
  const x = useTransform(scrollYProgress, [start, end], isLast ? [0, 0] : [0, 40]);
  const opacity = useTransform(
    scrollYProgress,
    isLast ? [start, end] : [start, end - segment * 0.15, end],
    isLast ? [1, 1] : [1, 1, 0]
  );
  const entranceScale = useTransform(
    scrollYProgress,
    [Math.max(0, start - segment), start],
    [0.94, 1]
  );

  return (
    <motion.div
      style={{ rotate, y, x, opacity, scale: entranceScale, zIndex: total - index }}
      className="absolute inset-0"
    >
      <LevelCard level={level} />
    </motion.div>
  );
}

function StaticStack({ levels }: { levels: Level[] }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
      {levels.map((level) => (
        <LevelCard key={level.id} level={level} />
      ))}
    </div>
  );
}

export function ProgramsPreview({ levels }: { levels: Level[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  return (
    <section id="programas" className="relative bg-surface">
      <div className="mx-auto max-w-3xl px-6 pb-8 pt-16 text-center">
        <h2 className="text-3xl font-bold text-primary md:text-4xl">
          Un camino claro, nivel por nivel
        </h2>
        <p className="mt-3 text-muted">
          Seis niveles alineados al Marco Común Europeo de Referencia (CEFR).
          Cada uno te prepara para avanzar con confianza al siguiente.
        </p>
      </div>

      {shouldReduceMotion ? (
        <StaticStack levels={levels} />
      ) : (
        <div ref={trackRef} style={{ height: `${levels.length * 70}vh` }} className="relative">
          <div className="sticky top-24 flex h-[70vh] items-center justify-center px-6">
            <div className="relative aspect-[3/4] w-full max-w-sm">
              {levels.map((level, i) => (
                <StackCard
                  key={level.id}
                  level={level}
                  index={i}
                  total={levels.length}
                  scrollYProgress={scrollYProgress}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pb-16 text-center">
        <a href="/programas">
          <Button variant="outline">Ver todos los niveles</Button>
        </a>
      </div>
    </section>
  );
}
