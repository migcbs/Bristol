"use client";

import { Section } from "@/components/ui/section";

const TESTIMONIALS = [
  {
    name: "María Fernanda G.",
    role: "Alumna, nivel B2",
    quote:
      "Entré sin saber casi nada y en año y medio ya podía sostener una entrevista de trabajo en inglés.",
  },
  {
    name: "Roberto C.",
    role: "Padre de familia",
    quote:
      "Me encanta que pueda ver el avance de mi hija y sus calificaciones desde el portal.",
  },
  {
    name: "Ana Sofía L.",
    role: "Alumna, nivel C1",
    quote:
      "Los grupos pequeños hacen toda la diferencia. Los profesores realmente conocen tu progreso.",
  },
];

const [featured, ...rest] = TESTIMONIALS;

export function Testimonials() {
  return (
    <Section className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-4xl">
        <svg
          width="40"
          height="32"
          viewBox="0 0 40 32"
          fill="none"
          className="text-accent"
          aria-hidden
        >
          <path
            d="M0 32V19.4C0 8.4 6.4 1.6 16.8 0L18.4 4.8C11.2 6.8 7.6 11.2 7.2 16.8H16V32H0ZM21.6 32V19.4C21.6 8.4 28 1.6 38.4 0L40 4.8C32.8 6.8 29.2 11.2 28.8 16.8H37.6V32H21.6Z"
            fill="currentColor"
          />
        </svg>
        <p className="mt-6 font-display text-2xl font-medium leading-snug md:text-3xl">
          {featured.quote}
        </p>
        <p className="mt-6 text-sm font-semibold text-white">{featured.name}</p>
        <p className="text-sm text-white/60">{featured.role}</p>

        <div className="mt-14 grid gap-10 border-t border-white/15 pt-10 md:grid-cols-2">
          {rest.map((t) => (
            <div key={t.name}>
              <p className="text-white/80">“{t.quote}”</p>
              <p className="mt-4 text-sm font-semibold">{t.name}</p>
              <p className="text-sm text-white/60">{t.role}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
