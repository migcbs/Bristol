import { prisma } from "@/lib/prisma";
import { LandingChromeProvider } from "@/components/landing/landing-chrome-context";
import { LenisRoot } from "@/components/landing/lenis-root";
import { SiteLoader } from "@/components/landing/site-loader";
import { HeroV2 } from "@/components/landing/hero-v2";
import { TrustV2 } from "@/components/landing/trust-v2";
import { ProgramsV2 } from "@/components/landing/programs-v2";
import { CampusesV2 } from "@/components/landing/campuses-v2";
import { StatsV2 } from "@/components/landing/stats-v2";
import { TestimonialsV2 } from "@/components/landing/testimonials-v2";
import { FooterV2 } from "@/components/landing/footer-v2";
import { ContactModal } from "@/components/landing/contact-modal";
import { MenuOverlay } from "@/components/landing/menu-overlay";

export const revalidate = 3600;

export default async function HomePage() {
  const [campuses, approvedTestimonials] = await Promise.all([
    prisma.campus.findMany({ orderBy: { name: "asc" } }),
    prisma.testimonial.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 9,
      select: { name: true, role: true, quote: true },
    }),
  ]);

  return (
    <LandingChromeProvider>
      <LenisRoot />
      <SiteLoader />
      <main className="w-full overflow-x-clip bg-white p-2 sm:p-3">
        <HeroV2 />
        <TrustV2 />
        <ProgramsV2 />
        <CampusesV2 campuses={campuses} />
        <StatsV2 />
        <TestimonialsV2 approved={approvedTestimonials} />
        <FooterV2 />
      </main>
      <ContactModal />
      <MenuOverlay />
    </LandingChromeProvider>
  );
}
