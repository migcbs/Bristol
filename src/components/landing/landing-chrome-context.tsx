"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared open/close state for the two overlays multiple entry points can
// trigger (header, fullscreen menu, footer CTA all open the same contact
// modal; header burger opens the same menu) — avoids prop-drilling through
// the whole landing tree.
interface LandingChromeState {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  contactOpen: boolean;
  setContactOpen: (v: boolean) => void;
}

const LandingChromeContext = createContext<LandingChromeState | null>(null);

export function LandingChromeProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <LandingChromeContext.Provider value={{ menuOpen, setMenuOpen, contactOpen, setContactOpen }}>
      {children}
    </LandingChromeContext.Provider>
  );
}

export function useLandingChrome() {
  const ctx = useContext(LandingChromeContext);
  if (!ctx) throw new Error("useLandingChrome must be used within LandingChromeProvider");
  return ctx;
}
