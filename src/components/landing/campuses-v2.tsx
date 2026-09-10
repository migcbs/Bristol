"use client";

import type { Campus } from "@prisma/client";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { LocationMap } from "@/components/ui/location-map";
import { ClipLines } from "./clip-reveal";

// Real campus coordinates (see campuses-preview.tsx) — an actual map per
// plantel stands in for the reference design's court photography, since no
// real campus photos exist yet. Honest beats fabricated stock photos.
const CAMPUS_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Coatepec: { latitude: 19.4561, longitude: -96.9575 },
  Xalapa: { latitude: 19.5438, longitude: -96.9102 },
};

export function CampusesV2({ campuses }: { campuses: Campus[] }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="planteles"
      className="-mt-10 rounded-[2rem] bg-white px-6 pt-16 pb-20 sm:px-10"
    >
      <div className="grid items-end gap-10 md:grid-cols-2">
        <div className="max-w-sm">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary"
          >
            <MapPin size={26} />
          </motion.div>
          <ClipLines
            lines={["Conoce nuestros", "planteles"]}
            className="mt-6 text-4xl font-medium tracking-tight text-primary sm:text-5xl"
            stagger={0.12}
          />
          <p className="mt-6 max-w-xs text-sm text-muted">
            Agenda tu examen de posicionamiento o una visita guiada — te esperamos en el plantel más
            cercano.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          {campuses.map((campus, i) => {
            const coords = CAMPUS_COORDINATES[campus.name];
            return (
              <motion.figure
                key={campus.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 48 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.14, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`m-0 flex-1 ${i === 1 ? "sm:mb-8" : ""}`}
              >
                <LocationMap location={campus.name} latitude={coords?.latitude} longitude={coords?.longitude} className="w-full" />
                <figcaption className="mt-3 max-w-[240px] text-sm text-muted">
                  {campus.address ?? "Dirección próximamente"}
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
