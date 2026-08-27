"use client";

import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

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

export function Testimonials() {
  return (
    <Section>
      <h2 className="text-center text-3xl font-bold text-primary">
        Lo que dicen nuestros alumnos
      </h2>
      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <Card key={t.name}>
            <p className="text-sm italic text-gray-700">“{t.quote}”</p>
            <p className="mt-4 text-sm font-semibold">{t.name}</p>
            <p className="text-xs text-gray-500">{t.role}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}
