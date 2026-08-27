"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const shouldReduceMotion = useReducedMotion();

  const yStairs = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "22%"]);
  const yCopy = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], shouldReduceMotion ? [1, 1] : [1, 0]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-primary text-primary-foreground"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />

      <div className="relative mx-auto grid min-h-[88vh] max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:py-0">
        <motion.div
          style={{ y: yCopy, opacity: fade }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="max-w-xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Aprende inglés con confianza
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/75">
            Programas presenciales por nivel, profesores dedicados, y planteles
            cerca de ti. Bristol te acompaña desde tu primera clase hasta la
            fluidez.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <a href="#contacto">
              <Button variant="accent">Solicita informes</Button>
            </a>
            <a href="#programas">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:border-white hover:bg-white/10 hover:text-white"
              >
                Ver programas
              </Button>
            </a>
          </div>
        </motion.div>

        <motion.div
          style={{ y: yStairs }}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none hidden items-end gap-3 md:flex"
          aria-hidden
        >
          {LEVELS.map((level, i) => (
            <div key={level} className="flex flex-col items-center gap-3">
              <div
                className="w-14 rounded-t-lg"
                style={{
                  height: `${72 + i * 34}px`,
                  background:
                    i === LEVELS.length - 1
                      ? "var(--color-accent)"
                      : `rgba(255,255,255,${0.12 + i * 0.09})`,
                }}
              />
              <span className="font-display text-xs font-bold tracking-wide text-white/70">
                {level}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
