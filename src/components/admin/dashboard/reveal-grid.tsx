"use client";

import { Children } from "react";
import { motion, useReducedMotion } from "framer-motion";

const EXPO = [0.16, 1, 0.3, 1] as const;

// Staggers a fade+rise entrance across a dashboard's KPI cards or quick-
// action tiles — the same spring/expo motion language rolled out to the
// header/nav (see admin-nav.tsx) and the landing rebuild, extended here to
// every área's dashboard per the user's 2026-09-09 instruction. Takes the
// grid's own server-rendered children (KpiCard/QuickActionTile stay plain
// Server Components) and only wraps each one in a motion.div — the
// className passed in still carries the actual grid layout.
export function RevealGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.07, ease: EXPO }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
