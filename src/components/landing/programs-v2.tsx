"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "./eyebrow";
import { ClipLines } from "./clip-reveal";

// Real program structure confirmed with the user this session — grouped
// by age band, plus the standalone certification track — not the tennis
// reference's junior/performance/adult/private-coaching categories.
const PROGRAMS = [
  { index: "01", name: "Niños", description: "Fundamentos de inglés con dinámicas lúdicas, de 4 a 12 años.", href: "#programas" },
  { index: "02", name: "Adolescentes", description: "Preparación académica y conversación para jóvenes de 13 a 17 años.", href: "#programas" },
  { index: "03", name: "Adultos", description: "Grupos flexibles para profesionistas, presencial o virtual.", href: "#programas" },
  { index: "04", name: "Certificaciones", description: "Preparación para exámenes Cambridge y certificación oficial.", href: "#programas" },
];

export function ProgramsV2() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="programas" className="bg-surface px-6 py-16 sm:px-10 sm:py-24">
      <Eyebrow>Programas de formación</Eyebrow>
      <ClipLines
        lines={["Un camino claro", "por nivel"]}
        className="mt-4 text-4xl font-medium tracking-tight text-primary sm:text-5xl"
      />

      <ul className="mt-14 list-none p-0">
        {PROGRAMS.map((program, i) => (
          <motion.li
            key={program.index}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ delay: i * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`border-t border-border ${i === PROGRAMS.length - 1 ? "border-b" : ""}`}
          >
            <a href={program.href} className="group flex items-center gap-6 py-7 focus-visible:bg-white">
              <span className="w-10 text-sm font-medium text-muted">{program.index}</span>
              <span className="flex-1">
                <span className="block text-2xl font-medium tracking-tight text-primary sm:text-3xl">{program.name}</span>
                <span className="mt-1 block text-sm text-muted">{program.description}</span>
              </span>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-white">
                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </a>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
