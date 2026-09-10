"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { startLenis, stopLenis } from "@/lib/lenis-controller";

const MIN_VISIBLE_MS = 1400;
const MAX_VISIBLE_MS = 2600;
const EXIT_MS = 850;

// Fired on `window` once the curtain starts sliding away, so the hero's
// headline/tagline (gated on it, per the reference design) can play their
// entrance the moment the loader lets go — not before.
export const LOADER_READY_EVENT = "bristol:loader-ready";

export function SiteLoader() {
  const shouldReduceMotion = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (shouldReduceMotion) {
      // Reduced motion: skip straight to ready, no curtain animation.
      window.dispatchEvent(new Event(LOADER_READY_EVENT));
      setMounted(false);
      return;
    }

    stopLenis();
    let fired = false;

    function reveal() {
      if (fired) return;
      fired = true;
      setExiting(true);
      startLenis();
      window.dispatchEvent(new Event(LOADER_READY_EVENT));
      setTimeout(() => setMounted(false), EXIT_MS);
    }

    const minTimer = setTimeout(() => {
      if (document.readyState === "complete") reveal();
    }, MIN_VISIBLE_MS);
    const maxTimer = setTimeout(reveal, MAX_VISIBLE_MS);

    function onLoad() {
      clearTimeout(minTimer);
      setTimeout(reveal, MIN_VISIBLE_MS);
    }
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      window.removeEventListener("load", onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReduceMotion]);

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ y: 0 }}
      animate={{ y: exiting ? "-105%" : 0 }}
      transition={{ duration: EXIT_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-primary-dark text-white"
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-2 font-display text-2xl font-medium tracking-[0.2em] uppercase"
      >
        Bristol
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </motion.div>
      <div className="h-px w-40 overflow-hidden rounded-full bg-white/20">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: (MIN_VISIBLE_MS - 120) / 1000, delay: 0.12, ease: [0.65, 0, 0.35, 1] }}
          style={{ transformOrigin: "left" }}
          className="h-full w-full bg-white"
        />
      </div>
    </motion.div>
  );
}
