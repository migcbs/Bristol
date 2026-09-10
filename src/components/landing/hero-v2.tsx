"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";
import { ClipWords, ClipLines } from "./clip-reveal";
import { NavHeader } from "./nav-v2";

// No real campus photography exists yet (same constraint the rest of the
// site works around) — the shader plate below is the honest substitute,
// not a stand-in for a photo we don't have.
export function HeroV2() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isActive, setIsActive] = useState(false);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const plateY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <section
      ref={sectionRef}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      className="relative isolate flex min-h-[calc(100svh-1rem)] w-full flex-col overflow-hidden rounded-[2rem] bg-primary-dark text-white sm:min-h-[calc(100svh-1.5rem)]"
      style={{ minHeight: "36rem" }}
    >
      <motion.div className="absolute inset-x-0 -top-[16%] -z-10 h-[132%] w-full" style={shouldReduceMotion ? undefined : { y: plateY }}>
        {!shouldReduceMotion && (
          <MeshGradient
            className="h-full w-full"
            colors={["#1c1c56", "#2b2b7a", "#3d3d9e", "#e63329", "#2b2b7a"]}
            speed={isActive ? 0.35 : 0.18}
            distortion={0.65}
            swirl={0.3}
            grainMixer={0}
            grainOverlay={isActive ? 0.06 : 0.03}
            fit="cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(15,47,99,0.65), rgba(15,47,99,0.35), rgba(15,47,99,0.75))" }}
        />
      </motion.div>

      <NavHeader />

      <div className="px-6 pt-4 sm:px-10">
        <h1 className="leading-[1.85] font-medium tracking-tight uppercase" style={{ fontSize: "clamp(2.75rem, 3.5vw, 9rem)" }}>
          <ClipWords text="Un inglés muy inglés" gate="loader" />
        </h1>
      </div>

      <div className="mt-auto flex flex-col gap-6 px-6 pb-8 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:pb-10">
        <ClipLines
          lines={["Somos profesionales en la enseñanza del Inglés"]}
          gate="loader"
          baseDelay={0.35}
          stagger={0.11}
          duration={0.9}
          className="font-medium tracking-tight text-white/85 uppercase"
          lineClassName="block"
        />
        <div className="flex items-end gap-4">
          <motion.article
            initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.78, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-xs items-stretch gap-3 rounded-3xl border border-white/15 bg-white/10 p-3 shadow-lg backdrop-blur-md sm:max-w-60"
          >
            <div className="flex flex-1 flex-col justify-between">
              <p className="font-display text-3xl leading-none font-bold">+30</p>
              <p className="mt-2 text-[0.65rem] text-white/80">Años formando alumnos en Bristol</p>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
