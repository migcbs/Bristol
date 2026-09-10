import type Lenis from "lenis";

// A tiny module-level singleton so the loader / contact modal / fullscreen
// menu can stop and restart the landing page's smooth scroll without each
// needing its own reference to the Lenis instance. LenisRoot (client
// component mounted once at the top of the landing page) owns the actual
// instance and registers it here.
let instance: Lenis | null = null;

export function registerLenis(lenis: Lenis | null) {
  instance = lenis;
}

export function stopLenis() {
  instance?.stop();
}

export function startLenis() {
  instance?.start();
}
