"use client";

import { useState } from "react";
import { SplashScreen } from "./splash-screen";

export function SplashGate({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      {children}
    </>
  );
}
