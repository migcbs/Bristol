"use client";

import { Search } from "lucide-react";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/admin/command-palette";

// Icon-only shortcut to the Cmd+K spotlight (CommandPalette) — not a
// separate search feature. Replaces the earlier standalone "Directorio"
// popup, which duplicated Cmd+K's own search.
export function SpotlightButton() {
  return (
    <button
      type="button"
      aria-label="Buscar (Cmd+K)"
      title="Buscar (Cmd+K)"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-all duration-200 hover:scale-105 hover:bg-surface hover:text-primary active:scale-95"
    >
      <Search size={16} />
    </button>
  );
}
