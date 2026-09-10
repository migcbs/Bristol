"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow } from "./eyebrow";
import { ClipLines } from "./clip-reveal";
import { PillButton } from "./pill-button";
import { CampusSocials } from "./campus-socials";
import { useLandingChrome } from "./landing-chrome-context";

export function FooterV2() {
  const shouldReduceMotion = useReducedMotion();
  const { setContactOpen } = useLandingChrome();
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="mt-3 rounded-[2rem] bg-primary-dark px-6 py-14 text-white sm:px-10 sm:py-16">
      <div className="flex flex-col gap-8 border-b border-white/15 pb-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow tone="light">Empieza hoy</Eyebrow>
          <ClipLines lines={["¿Listo para", "empezar?"]} className="mt-4 text-5xl leading-[0.95] font-medium tracking-tight sm:text-6xl" />
        </div>
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <PillButton variant="light" onClick={() => setContactOpen(true)}>
            Solicitar información
          </PillButton>
        </motion.div>
      </div>

      <div className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-xs">
          <p className="flex items-center gap-2 font-display text-lg font-medium tracking-[0.2em] uppercase">
            Bristol
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          </p>
          <p className="mt-4 text-sm text-white/65">
            Inglés profesional, presencial y virtual, con profesores dedicados y planteles cerca de ti.
          </p>
          <address className="mt-6 space-y-1 text-sm text-white/80 not-italic">
            <a href="mailto:hola@bristol-ingles.com" className="block hover:text-white hover:underline">
              hola@bristol-ingles.com
            </a>
            <a href="tel:+525500000000" className="block hover:text-white hover:underline">
              (55) 0000 0000
            </a>
          </address>
        </div>

        <nav>
          <h3 className="text-xs font-medium tracking-[0.2em] text-white/50 uppercase">Programas</h3>
          <ul className="mt-4 list-none space-y-3 p-0 text-sm text-white/80">
            <li>
              <a href="#programas" className="hover:text-white">
                Niños
              </a>
            </li>
            <li>
              <a href="#programas" className="hover:text-white">
                Adolescentes
              </a>
            </li>
            <li>
              <a href="#programas" className="hover:text-white">
                Adultos
              </a>
            </li>
            <li>
              <a href="#programas" className="hover:text-white">
                Certificaciones
              </a>
            </li>
          </ul>
        </nav>

        <nav>
          <h3 className="text-xs font-medium tracking-[0.2em] text-white/50 uppercase">Escuela</h3>
          <ul className="mt-4 list-none space-y-3 p-0 text-sm text-white/80">
            <li>
              <a href="/programas" className="hover:text-white">
                Programas
              </a>
            </li>
            <li>
              <a href="/planteles" className="hover:text-white">
                Planteles
              </a>
            </li>
            <li>
              <a href="#testimonials" className="hover:text-white">
                Testimonios
              </a>
            </li>
            <li>
              <a href="/login" className="hover:text-white">
                Portal
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <CampusSocials className="border-t border-white/15 pt-10" />

      <div className="mt-10 flex flex-col gap-5 border-t border-white/15 pt-8 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} Bristol Inglés Profesional. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
