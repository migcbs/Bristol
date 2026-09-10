"use client";

import { motion, useReducedMotion } from "framer-motion";

// The exact wordmark treatment from the landing nav (src/components/landing/nav.tsx)
// — reused in the admin/portal chrome so those feel like the same product,
// not a bolted-on back office. `area` renders as a small badge next to it
// (e.g. "BRISTOL · Recepción"). Truncates on narrow screens (some áreas,
// like "Dirección de Campus", are long) rather than pushing the header's
// right-side icons off-screen. A quiet fade+rise on mount — same spring
// motion language as the landing page's wordmark, just once per page load,
// not on every navigation (no re-trigger cost for a tool used all day).
export function BristolWordmark({ area }: { area?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-w-0 items-center gap-2 sm:gap-3"
    >
      <span className="flex shrink-0 items-center gap-1.5 font-display text-lg font-bold text-primary sm:text-xl">
        Bristol
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      </span>
      {area && (
        <motion.span
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="truncate rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary uppercase sm:px-3 sm:text-xs"
        >
          {area}
        </motion.span>
      )}
    </motion.div>
  );
}
