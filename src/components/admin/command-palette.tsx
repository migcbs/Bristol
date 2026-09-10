"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search } from "lucide-react";

interface StudentResult {
  id: string;
  matricula: string;
  user: { name: string };
  campus: { name: string };
  enrollments: { group: { name: string; level: { code: string } } | null }[];
}
interface LeadResult {
  id: string;
  name: string;
  email: string;
  source: string;
}
interface GroupResult {
  id: string;
  name: string;
  codigoGrupo: string | null;
  level: { code: string };
}
interface CursoResult {
  id: string;
  nombre: string;
  categoria: string;
  esCertificacion: boolean;
}
interface ParentResult {
  id: string;
  name: string;
  email: string;
  parentLinks: { student: { user: { name: string } } }[];
}

interface SearchResults {
  intent: { type: string; term: string } | null;
  summary?: string;
  students: StudentResult[];
  leads: LeadResult[];
  groups: GroupResult[];
  cursos: CursoResult[];
  parents: ParentResult[];
}

type FlatItem =
  | { kind: "student"; data: StudentResult }
  | { kind: "lead"; data: LeadResult }
  | { kind: "group"; data: GroupResult }
  | { kind: "curso"; data: CursoResult }
  | { kind: "parent"; data: ParentResult };

const CATEGORY_CATEGORIA_LABELS: Record<string, string> = {
  NINOS: "Niños",
  ADOLESCENTES: "Adolescentes",
  ADULTOS: "Adultos",
};

// Fired by SpotlightButton (the header's lupa icon) to open this same
// palette — kept as a plain window event rather than lifting state up
// since AdminLayout is a Server Component and can't hold client state.
export const OPEN_COMMAND_PALETTE_EVENT = "bristol:open-command-palette";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function handleExternalOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleExternalOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleExternalOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setActiveIndex(0);
      // Let the dialog mount before focusing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setResults(await res.json());
        setActiveIndex(0);
      }
    } catch {
      setResults(null);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  const items: FlatItem[] = useMemo(() => {
    if (!results) return [];
    return [
      ...results.students.map((data): FlatItem => ({ kind: "student", data })),
      ...results.parents.map((data): FlatItem => ({ kind: "parent", data })),
      ...results.leads.map((data): FlatItem => ({ kind: "lead", data })),
      ...results.groups.map((data): FlatItem => ({ kind: "group", data })),
      ...results.cursos.map((data): FlatItem => ({ kind: "curso", data })),
    ];
  }, [results]);

  function handleInputKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-white shadow-[0_30px_70px_-20px_rgba(20,20,43,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Busca un alumno, grupo, curso, lead o tutor… o pregunta algo como “alumnos del grupo A1”"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden shrink-0 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted sm:block">
            Esc
          </kbd>
        </div>

        {results && (
          <div className="max-h-96 overflow-y-auto p-2">
            {results.summary && (
              <p className="px-3 py-2 text-xs font-medium text-muted">{results.summary}</p>
            )}

            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">Sin resultados.</p>
            )}

            {items.map((item, index) => (
              <ResultRow
                key={`${item.kind}-${item.data.id}`}
                item={item}
                active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
              />
            ))}
          </div>
        )}

        {!results && (
          <div className="px-5 py-6 text-center text-sm text-muted">
            Escribe al menos 2 caracteres para buscar.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  item,
  active,
  onMouseEnter,
}: {
  item: FlatItem;
  active: boolean;
  onMouseEnter: () => void;
}) {
  const rowClass = `flex w-full cursor-default flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
    active ? "bg-primary text-primary-foreground" : "text-text"
  }`;
  const mutedClass = active ? "text-white/70" : "text-muted";

  let content: ReactNode;

  if (item.kind === "student") {
    const activeEnrollment = item.data.enrollments[0]?.group;
    content = (
      <>
        <span className="font-medium">
          {item.data.user.name} <span className={mutedClass}>· {item.data.matricula}</span>
        </span>
        <span className={`text-xs ${mutedClass}`}>
          {item.data.campus.name}
          {activeEnrollment && ` · ${activeEnrollment.name} (${activeEnrollment.level.code})`}
        </span>
      </>
    );
  } else if (item.kind === "parent") {
    const children = item.data.parentLinks.map((l) => l.student.user.name).join(", ");
    content = (
      <>
        <span className="font-medium">{item.data.name} <span className={mutedClass}>· Padre/tutor</span></span>
        <span className={`text-xs ${mutedClass}`}>
          {item.data.email}
          {children && ` · Hijo(a): ${children}`}
        </span>
      </>
    );
  } else if (item.kind === "lead") {
    content = (
      <>
        <span className="font-medium">{item.data.name} <span className={mutedClass}>· Lead</span></span>
        <span className={`text-xs ${mutedClass}`}>{item.data.email}</span>
      </>
    );
  } else if (item.kind === "group") {
    content = (
      <>
        <span className="font-medium">
          {item.data.name} <span className={mutedClass}>· Grupo{item.data.codigoGrupo ? ` ${item.data.codigoGrupo}` : ""}</span>
        </span>
        <span className={`text-xs ${mutedClass}`}>Nivel {item.data.level.code}</span>
      </>
    );
  } else {
    content = (
      <>
        <span className="font-medium">
          {item.data.nombre} <span className={mutedClass}>· Curso</span>
        </span>
        <span className={`text-xs ${mutedClass}`}>
          {CATEGORY_CATEGORIA_LABELS[item.data.categoria] ?? item.data.categoria}
          {item.data.esCertificacion && " · Certificación"}
        </span>
      </>
    );
  }

  return (
    <div className={rowClass} onMouseEnter={onMouseEnter}>
      {content}
    </div>
  );
}
