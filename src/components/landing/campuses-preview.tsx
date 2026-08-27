"use client";

import type { Campus } from "@prisma/client";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";

export function CampusesPreview({ campuses }: { campuses: Campus[] }) {
  return (
    <Section id="planteles" className="bg-surface">
      <h2 className="text-center text-3xl font-bold text-primary">Nuestros planteles</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
        Encuentra el plantel Bristol más cercano a ti.
      </p>
      <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
        {campuses.map((campus) => (
          <Card key={campus.id}>
            <h3 className="text-lg font-semibold">{campus.name}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {campus.address ?? "Dirección próximamente"}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-8 text-center">
        <a href="/planteles" className="font-medium text-primary hover:underline">
          Ver todos los planteles →
        </a>
      </div>
    </Section>
  );
}
