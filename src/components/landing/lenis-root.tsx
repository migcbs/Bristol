"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { registerLenis } from "@/lib/lenis-controller";

// Mounted once at the top of the landing page. Drives Lenis's own rAF loop
// per its docs; registers the instance so SiteLoader / ContactModal /
// MenuOverlay can stop/start it (scroll-lock while a modal or menu is open,
// or while the loader curtain is up) without prop-drilling a ref through
// the whole tree.
export function LenisRoot() {
  useEffect(() => {
    const lenis = new Lenis({ smoothWheel: true });
    registerLenis(lenis);

    let frame: number;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    window.scrollTo(0, 0);

    return () => {
      cancelAnimationFrame(frame);
      registerLenis(null);
      lenis.destroy();
    };
  }, []);

  return null;
}
