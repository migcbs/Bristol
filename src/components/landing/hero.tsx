"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const FEATURE_BARS = ["Clases presenciales", "Profesores certificados", "Seis niveles CEFR"];

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const shouldReduceMotion = useReducedMotion();

  const yStairs = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["0%", "18%"]);

  const barsContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.12 } },
  };
  const barItem: Variants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section className="flex min-h-screen w-full flex-col gap-2 overflow-hidden bg-surface px-3 pb-2 pt-24 md:px-5">
      <motion.div
        variants={barsContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-2 md:grid-cols-3"
      >
        {FEATURE_BARS.map((label) => (
          <motion.div
            key={label}
            variants={barItem}
            className="flex h-16 items-center justify-center rounded-2xl bg-white text-center text-sm font-semibold text-primary shadow-[0_1px_2px_rgba(20,20,43,0.04),0_12px_28px_-16px_rgba(20,20,43,0.22)] md:h-20 md:text-base"
          >
            {label}
          </motion.div>
        ))}
      </motion.div>

      <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />

        <motion.div
          style={{ y: yStairs }}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute right-6 top-10 hidden items-end gap-2.5 opacity-70 md:flex lg:right-10"
          aria-hidden
        >
          {LEVELS.map((level, i) => (
            <div key={level} className="flex flex-col items-center gap-2">
              <div
                className="w-10 rounded-t-md lg:w-12"
                style={{
                  height: `${56 + i * 26}px`,
                  background:
                    i === LEVELS.length - 1
                      ? "var(--color-accent)"
                      : `rgba(255,255,255,${0.12 + i * 0.09})`,
                }}
              />
              <span className="font-display text-[10px] font-bold tracking-wide text-white/60">
                {level}
              </span>
            </div>
          ))}
        </motion.div>

        <p className="absolute left-5 top-5 max-w-[15rem] font-display text-xs font-semibold leading-5 text-white/70 md:left-8 md:top-8 md:max-w-xs md:text-sm">
          Programas presenciales por nivel, con profesores dedicados y planteles
          cerca de ti.
        </p>

        <div className="absolute bottom-6 left-5 right-5 md:bottom-10 md:left-8 md:right-8">
          <span className="mb-2 block font-display text-xs font-semibold text-white/70 md:mb-3 md:text-sm">
            Bristol · Inglés Profesional
          </span>
          <h1 className="font-display text-[clamp(2.75rem,10vw,6.5rem)] font-bold leading-[0.92] tracking-tight">
            Aprende
            <br />
            inglés
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-4 md:mt-8">
            <a href="#contacto">
              <Button variant="accent">Solicita informes</Button>
            </a>
            <a
              href="#programas"
              className="text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white"
            >
              Ver programas
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
