"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";
import { LOADER_READY_EVENT } from "./site-loader";

const EXPO = [0.16, 1, 0.3, 1] as const;

// Clip-mask line reveal ("StackedLines" in the reference design) — each
// line sits in an overflow-hidden box and slides up from below into view.
// `gate="loader"` waits for the site loader to finish before playing
// (used by hero copy); the default plays once the block scrolls into view.
export function ClipLines({
  lines,
  className,
  lineClassName,
  gate = "inview",
  stagger = 0.12,
  duration = 0.95,
  baseDelay = 0,
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
  gate?: "loader" | "inview" | "immediate";
  stagger?: number;
  duration?: number;
  baseDelay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [loaderReady, setLoaderReady] = useState(gate !== "loader");

  useEffect(() => {
    if (gate !== "loader") return;
    function onReady() {
      setLoaderReady(true);
    }
    window.addEventListener(LOADER_READY_EVENT, onReady);
    return () => window.removeEventListener(LOADER_READY_EVENT, onReady);
  }, [gate]);

  const play = shouldReduceMotion || gate === "immediate" || (gate === "loader" ? loaderReady : inView);

  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.14em]">
          <motion.span
            className={lineClassName ?? "block"}
            initial={shouldReduceMotion ? false : { y: "115%", opacity: 0 }}
            animate={play ? { y: 0, opacity: 1 } : {}}
            transition={{ duration, delay: baseDelay + i * stagger, ease: EXPO }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

// Word-by-word clip-mask reveal for the hero headline — a single visual
// line, each word its own clip box, staggered.
export function ClipWords({
  text,
  className,
  wordClassName,
  gate = "loader",
  stagger = 0.14,
  duration = 1.1,
  baseDelay = 0,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  gate?: "loader" | "inview" | "immediate";
  stagger?: number;
  duration?: number;
  baseDelay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [ready, setReady] = useState(gate !== "loader");

  useEffect(() => {
    if (gate !== "loader") return;
    function onReady() {
      setReady(true);
    }
    window.addEventListener(LOADER_READY_EVENT, onReady);
    return () => window.removeEventListener(LOADER_READY_EVENT, onReady);
  }, [gate]);

  const play = shouldReduceMotion || gate === "immediate" || ready;
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
          <motion.span
            className={wordClassName ?? "inline-block"}
            initial={shouldReduceMotion ? false : { y: "115%", opacity: 0 }}
            animate={play ? { y: 0, opacity: 1 } : {}}
            transition={{ duration, delay: baseDelay + i * stagger, ease: EXPO }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
