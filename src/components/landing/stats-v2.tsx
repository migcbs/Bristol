"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow } from "./eyebrow";
import { ClipLines } from "./clip-reveal";

// Same real, confirmed facts as the original Trust section (see
// trust.tsx) — reused here as the navy stats band instead of inventing
// tennis-club numbers.
const STATS = [
  { value: "+20", label: "Años de experiencia enseñando inglés" },
  { value: "SEP", label: "Certificación oficial como institución" },
  { value: "Cambridge", label: "Afiliación académica internacional" },
  { value: "2", label: "Modalidades: presencial y virtual" },
];

export function StatsV2() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="mt-3 rounded-[2rem] bg-primary-dark px-6 py-20 text-white sm:px-10">
      <Eyebrow tone="light">Bristol en cifras</Eyebrow>
      <ClipLines
        lines={["Una escuela que", "respalda su nivel"]}
        className="mt-4 text-4xl font-medium tracking-tight sm:text-5xl"
      />

      <dl className="mt-16 grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: i * 0.11, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-white/20 pt-5"
          >
            <dd className="text-5xl font-medium tracking-tight sm:text-6xl">{stat.value}</dd>
            <dt className="mt-3 text-sm text-white/65">{stat.label}</dt>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}
