import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { ProgramsPreview } from "@/components/landing/programs-preview";
import { CampusesPreview } from "@/components/landing/campuses-preview";
import { Testimonials } from "@/components/landing/testimonials";
import { PricingPreview } from "@/components/landing/pricing-preview";
import { LeadForm } from "@/components/landing/lead-form";

export const revalidate = 3600;

export default async function HomePage() {
  const [levels, campuses] = await Promise.all([
    prisma.level.findMany({ orderBy: { code: "asc" } }),
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <ProgramsPreview levels={levels} />
      <CampusesPreview campuses={campuses} />
      <Testimonials />
      <PricingPreview />
      <LeadForm />
      <Footer />
    </div>
  );
}
