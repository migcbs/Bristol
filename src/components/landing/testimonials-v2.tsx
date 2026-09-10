"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow } from "./eyebrow";
import { ClipLines } from "./clip-reveal";
import { LeaveReviewForm } from "./leave-review-form";

interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

// Same real, curated reviews as the original Testimonials section — real
// reviews from the moderation queue take over once there are 3+ approved,
// exactly like before.
const CURATED_TESTIMONIALS: Testimonial[] = [
  {
    name: "María Fernanda G.",
    role: "Alumna, nivel B2",
    quote: "Entré sin saber casi nada y en año y medio ya podía sostener una entrevista de trabajo en inglés.",
  },
  {
    name: "Roberto C.",
    role: "Padre de familia",
    quote: "Me encanta que pueda ver el avance de mi hija y sus calificaciones desde el portal.",
  },
  {
    name: "Ana Sofía L.",
    role: "Alumna, nivel C1",
    quote: "Los grupos pequeños hacen toda la diferencia. Los profesores realmente conocen tu progreso.",
  },
];

export function TestimonialsV2({ approved = [] }: { approved?: { name: string; role: string | null; quote: string }[] }) {
  const shouldReduceMotion = useReducedMotion();
  const testimonials: Testimonial[] =
    approved.length >= 3 ? approved.map((t) => ({ name: t.name, role: t.role ?? "", quote: t.quote })) : CURATED_TESTIMONIALS;

  return (
    <section id="testimonials" className="bg-white px-6 py-20 sm:px-10 sm:py-24">
      <Eyebrow>Lo que dicen los alumnos</Eyebrow>
      <ClipLines
        lines={["Querido por", "nuestros alumnos"]}
        className="mt-4 text-4xl font-medium tracking-tight text-primary sm:text-5xl"
      />

      <ul className="mt-14 grid list-none gap-5 p-0 md:grid-cols-3">
        {testimonials.map((testimonial, i) => (
          <motion.li
            key={testimonial.name}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            whileHover={shouldReduceMotion ? undefined : { y: -8 }}
            transition={{ delay: i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-full flex-col justify-between rounded-3xl bg-surface p-7"
          >
            <div>
              <span aria-hidden className="font-display text-4xl leading-none text-primary">
                &ldquo;
              </span>
              <blockquote className="mt-4 leading-relaxed text-text">{testimonial.quote}</blockquote>
            </div>
            <figcaption className="mt-6 border-t border-border pt-4">
              <p className="font-medium text-primary">{testimonial.name}</p>
              <p className="text-sm text-muted">{testimonial.role}</p>
            </figcaption>
          </motion.li>
        ))}
      </ul>

      <div className="mt-10 flex justify-center">
        <LeaveReviewForm />
      </div>
    </section>
  );
}
