"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";

// Shared popup shell for every record-detail/form popup in the admin and
// portal. Fixes a real, reproducible bug found 2026-09-09: every ad-hoc
// popup before this (AlumnoViewModal, GroupEditModal, etc.) rendered its
// `fixed inset-0` overlay as a normal DOM child of the RecordCard that
// opened it, and RecordCard has `hover:-translate-y-0.5` (a CSS
// transform). Per the CSS spec, a `position: fixed` element positions
// itself relative to the nearest ancestor that has a `transform` set —
// so the instant the cursor re-entered the card underneath the popup,
// the card's :hover transform kicked in and the "fixed" popup snapped to
// be positioned relative to that small card instead of the viewport, then
// snapped back the moment the cursor left it — the flicker the user saw.
// `createPortal` renders the overlay directly under <body>, completely
// outside any hoverable/transformed ancestor, so this can't happen again
// no matter what CSS the trigger card uses.
export function Modal({
  open,
  onClose,
  children,
  widthClassName = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={clsx(
          "flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl",
          widthClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
