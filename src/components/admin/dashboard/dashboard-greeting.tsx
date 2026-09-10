"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ClipLines } from "@/components/landing/clip-reveal";

// Every área's dashboard opens with this — the same clip-mask line reveal
// used for the landing page's headlines, extended here per the user's
// 2026-09-09 instruction ("...tambien quiero que lo apliques en todas las
// ventanas de las diferentes áreas"). `gate="immediate"` (not "inview" or
// "loader"): a dashboard renders already on-screen, at the top of the
// page, with nothing to scroll into and no site loader gating it.
export function DashboardGreeting({ greeting, subtitle }: { greeting: string; subtitle: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div>
      <ClipLines
        lines={[greeting]}
        gate="immediate"
        duration={0.7}
        className="font-display text-2xl font-bold text-primary"
      />
      <motion.p
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-1 text-sm text-muted"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}
