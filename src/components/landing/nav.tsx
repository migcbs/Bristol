"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const SECTION_LINKS = [
  { href: "#programas", label: "Programas" },
  { href: "#planteles", label: "Planteles" },
  { href: "#precios", label: "Precios" },
];

const PAGE_LINKS = [
  { href: "/programas", label: "Programas" },
  { href: "/planteles", label: "Planteles" },
  { href: "/precios", label: "Precios" },
];

export function Nav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const links = isHome ? SECTION_LINKS : PAGE_LINKS;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-white/90 px-6 py-4 backdrop-blur">
      <Link href="/" className="text-lg font-bold text-primary">
        Bristol
      </Link>
      <nav className="hidden gap-6 text-sm font-medium md:flex">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-primary">
            {link.label}
          </a>
        ))}
      </nav>
      <Link href="/login">
        <Button variant="outline">Iniciar sesión</Button>
      </Link>
    </header>
  );
}
