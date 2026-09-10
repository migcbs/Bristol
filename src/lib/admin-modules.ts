import {
  UserPlus,
  Users,
  Megaphone,
  Wallet,
  Package,
  GraduationCap,
  Clock,
  Calendar,
  NotebookPen,
  RefreshCw,
  FileText,
  BookOpen,
  AlertTriangle,
  MessageSquare,
  Star,
  Ticket,
  Layers,
  type LucideIcon,
} from "lucide-react";

// One entry per screen, gated by the ONE module that actually owns it — no
// module is reused across areas (see src/lib/staff-permissions.ts for the
// 2026-09-09 cleanup). Shared by AdminNav (client, renders the nav) and
// GenericDashboard (server, renders the fallback quick-action grid) — kept
// in a plain module (no "use client") so a Server Component can import the
// real array instead of a client-reference proxy.
export const ADMIN_MODULES: { href: string; label: string; module: string; icon: LucideIcon }[] = [
  { href: "/admin/admisiones", label: "Admisiones", module: "admisiones", icon: UserPlus },
  { href: "/admin/comercial/ex-alumnos", label: "Ex Alumnos", module: "comercial_directorio", icon: Users },
  { href: "/admin/mercadotecnia", label: "Mercadotecnia", module: "mercadotecnia", icon: Megaphone },
  { href: "/admin/cobranzas", label: "Cobranzas", module: "cobranzas", icon: Wallet },
  { href: "/admin/caja/movimientos", label: "Caja", module: "recursos_caja", icon: Wallet },
  { href: "/admin/caja/recursos-materiales", label: "Recursos Materiales", module: "recursos_caja", icon: Package },
  { href: "/admin/recepcion/alumnos", label: "Alumnos", module: "alta_rapida", icon: GraduationCap },
  { href: "/admin/recepcion/lista-espera", label: "Lista de Espera", module: "lista_espera", icon: Clock },
  { href: "/admin/recepcion/agenda", label: "Agenda", module: "agenda", icon: Calendar },
  { href: "/admin/recepcion/bitacora", label: "Bitácora", module: "bitacora", icon: NotebookPen },
  { href: "/admin/direccion/grupos", label: "Grupos", module: "grupos", icon: Layers },
  { href: "/admin/reinscripciones", label: "Reinscripciones", module: "reinscripciones", icon: RefreshCw },
  { href: "/admin/control-escolar/solicitudes", label: "Solicitudes", module: "solicitudes", icon: FileText },
  { href: "/admin/control-escolar/biblioteca", label: "Biblioteca de Material", module: "biblioteca_material", icon: BookOpen },
  { href: "/admin/incidencias", label: "Incidencias", module: "incidencias", icon: AlertTriangle },
  { href: "/admin/comunicaciones", label: "Comunicaciones", module: "comunicaciones", icon: MessageSquare },
  { href: "/admin/comunicaciones/resenas", label: "Reseñas", module: "resenas", icon: Star },
  { href: "/admin/tickets", label: "Tickets", module: "tickets", icon: Ticket },
];
