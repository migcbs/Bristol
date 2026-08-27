"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const yBack = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const yFront = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  return (
    <div ref={ref} className="relative flex min-h-[85vh] items-center overflow-hidden bg-surface">
      <motion.div
        style={{ y: yBack }}
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10"
      />
      <motion.div
        style={{ y: yFront }}
        className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-accent/10"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-3xl px-6 text-center"
      >
        <h1 className="text-4xl font-bold text-primary md:text-6xl">
          Aprende inglés con confianza
        </h1>
        <p className="mt-6 text-lg text-gray-700 md:text-xl">
          Programas presenciales por niveles, profesores dedicados, y planteles
          cerca de ti. Bristol te acompaña desde tu primera clase hasta la fluidez.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <a href="#contacto">
            <Button variant="accent">Solicita informes</Button>
          </a>
          <a href="#programas">
            <Button variant="outline">Ver programas</Button>
          </a>
        </div>
      </motion.div>
    </div>
  );
}
