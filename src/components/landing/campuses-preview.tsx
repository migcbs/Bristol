"use client";

import type { Campus } from "@prisma/client";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

export function CampusesPreview({ campuses }: { campuses: Campus[] }) {
  return (
    <Section id="planteles" className="bg-surface">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[0.8fr_1.2fr] md:items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary md:text-4xl">
            Cerca de ti, en cada ciudad
          </h2>
          <p className="mt-4 text-muted">
            Encuentra el plantel Bristol más cercano y empieza tu próxima
            clase esta semana.
          </p>
          <p className="mt-8 font-display text-6xl font-bold text-primary">
            {campuses.length}
            <span className="ml-2 text-lg font-semibold text-muted">
              planteles activos
            </span>
          </p>
          <a href="/planteles" className="mt-8 inline-block">
            <Button variant="outline">Ver todos los planteles</Button>
          </a>
        </div>

        <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
          {campuses.map((campus) => (
            <li key={campus.id} className="flex items-start gap-4 p-6">
              <span
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                aria-hidden
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">{campus.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {campus.address ?? "Dirección próximamente"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
