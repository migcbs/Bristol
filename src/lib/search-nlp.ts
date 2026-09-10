// Rule-based, zero-cost "natural language" layer for the admin command
// palette. No LLM call, no API key, no cost — just pattern matching on a
// handful of Spanish phrasings staff actually use ("alumnos del grupo X",
// "alumnos de nivel X", "leads de redes sociales", "padres de X"). Anything
// that doesn't match a pattern falls through to plain fuzzy search across
// every entity — the palette never goes blank just because the sentence
// wasn't one we anticipated.

export type SmartIntent =
  | { type: "students_by_group"; term: string }
  | { type: "students_by_level"; term: string }
  | { type: "students_by_campus"; term: string }
  | { type: "leads_by_source"; term: string }
  | { type: "parents"; term: string };

const PATTERNS: { regex: RegExp; build: (term: string) => SmartIntent }[] = [
  {
    regex: /^alumnos?\s+(?:del?|de la)\s+grupo\s+(.+)$/i,
    build: (term) => ({ type: "students_by_group", term }),
  },
  {
    regex: /^alumnos?\s+(?:del?|de la)\s+nivel\s+(.+)$/i,
    build: (term) => ({ type: "students_by_level", term }),
  },
  {
    regex: /^alumnos?\s+(?:del?|de la|en)\s+(?:campus|plantel)\s+(.+)$/i,
    build: (term) => ({ type: "students_by_campus", term }),
  },
  {
    regex: /^leads?\s+(?:del?|de)\s+(.+)$/i,
    build: (term) => ({ type: "leads_by_source", term }),
  },
  {
    regex: /^(?:padres?|tutores?)\s+(?:de|del)?\s*(.+)$/i,
    build: (term) => ({ type: "parents", term }),
  },
];

/**
 * Tries to recognize a handful of common Spanish query shapes. Returns
 * null when nothing matches — the caller should fall back to plain fuzzy
 * search across all entities in that case.
 */
export function parseSmartQuery(query: string): SmartIntent | null {
  const trimmed = query.trim();
  for (const { regex, build } of PATTERNS) {
    const match = trimmed.match(regex);
    if (match && match[1]?.trim()) {
      return build(match[1].trim());
    }
  }
  return null;
}
