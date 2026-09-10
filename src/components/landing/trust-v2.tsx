"use client";

import { motion, useReducedMotion } from "framer-motion";

// Real, confirmed facts only (same set as the original Trust section) —
// no invented coach photos or names stand in here, since none exist.
const CREDENTIAL_CHIPS = ["SEP", "Cambridge", "Presencial y virtual"];

// A real Unsplash photo — four young people studying together around a
// table, laughing (per the user's request 2026-09-09: "que se vean
// jóvenes estudiando y felices"). A plain <img> (not next/image) so no
// remote-domain allowlist is needed; a lighter gradient scrim keeps the
// text and cards legible while letting the photo read through.
const PHOTO_URL =
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1600&q=80";

function GhostWord({ children }: { children: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <span className="overflow-hidden pb-[0.12em]">
      <motion.span
        initial={shouldReduceMotion ? false : { y: "115%", opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="block text-white/85"
      >
        {children}
      </motion.span>
    </span>
  );
}

export function TrustV2() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="px-2 py-8 sm:px-3 sm:py-10">
      <div className="relative isolate flex min-h-[46svh] flex-col justify-between gap-6 overflow-hidden rounded-[2rem] bg-primary-dark px-6 py-8 text-white sm:min-h-[50svh] sm:gap-8 sm:px-10 sm:py-10">
        {/* Slow, light "close-up" push-in on the photo (per the user's
            request 2026-09-09): it eases from its natural size to a
            gentle ~8% zoom while the section is on screen, then holds —
            a subtle Ken-Burns move, not a loop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src={PHOTO_URL}
          alt=""
          aria-hidden
          initial={shouldReduceMotion ? false : { scale: 1 }}
          whileInView={shouldReduceMotion ? undefined : { scale: 1.08 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 -z-20 h-full w-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-dark/80 via-primary-dark/55 to-primary-dark/85" />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-white/10 text-center backdrop-blur-sm sm:h-32 sm:w-32"
          >
            <span className="font-display text-2xl font-medium text-white">+20</span>
            <span className="mt-1 max-w-[7em] text-[0.6rem] text-white/70">Años formando alumnos</span>
          </motion.div>

          <motion.article
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md rounded-3xl bg-white/10 p-5 backdrop-blur-md sm:p-6"
          >
            <span className="inline-block rounded-xl bg-white/15 px-4 py-2 font-display text-xl font-medium text-white">
              #01
            </span>
            <h3 className="mt-4 text-lg font-medium text-white">Confían en Bristol</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/75">
              De niños que dan sus primeros pasos hasta adultos que certifican su nivel para el trabajo, los alumnos
              avanzan aquí porque el progreso se nota en la vida real, no solo en el examen.
            </p>
          </motion.article>
        </div>

        <h2
          className="pointer-events-none mx-auto max-w-6xl text-center leading-[1.02] font-medium tracking-tight uppercase select-none"
          style={{ fontSize: "clamp(1.75rem, 7vw, 4.75rem)" }}
        >
          <span className="flex justify-between">
            <GhostWord>Formación</GhostWord>
            <GhostWord>Certificada</GhostWord>
          </span>
          <span className="flex justify-between">
            <GhostWord>Nivel</GhostWord>
            <GhostWord>Cambridge</GhostWord>
          </span>
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {CREDENTIAL_CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/25 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-sm"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
