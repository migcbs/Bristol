"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      onComplete();
      return;
    }

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setCount(step);
      if (step >= 100) {
        clearInterval(interval);
        setTimeout(() => setExiting(true), 200);
        setTimeout(onComplete, 900);
      }
    }, 20);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-end justify-start bg-white transition-opacity duration-700 ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden
    >
      <span className="p-6 font-display text-7xl font-bold leading-none tabular-nums text-primary md:p-10 md:text-9xl">
        {count}
      </span>
    </div>
  );
}
