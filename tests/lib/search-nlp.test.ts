import { describe, it, expect } from "vitest";
import { parseSmartQuery } from "@/lib/search-nlp";

describe("parseSmartQuery", () => {
  it("recognizes 'alumnos del grupo X'", () => {
    expect(parseSmartQuery("alumnos del grupo A1 Matutino")).toEqual({
      type: "students_by_group",
      term: "A1 Matutino",
    });
  });

  it("recognizes 'alumnos de nivel X'", () => {
    expect(parseSmartQuery("alumnos de nivel B2")).toEqual({
      type: "students_by_level",
      term: "B2",
    });
  });

  it("recognizes 'alumnos en campus/plantel X'", () => {
    expect(parseSmartQuery("alumnos en plantel Xalapa")).toEqual({
      type: "students_by_campus",
      term: "Xalapa",
    });
  });

  it("recognizes 'leads de X'", () => {
    expect(parseSmartQuery("leads de redes sociales")).toEqual({
      type: "leads_by_source",
      term: "redes sociales",
    });
  });

  it("recognizes 'padres de X'", () => {
    expect(parseSmartQuery("padres de Ana García")).toEqual({
      type: "parents",
      term: "Ana García",
    });
  });

  it("recognizes bare 'tutores'", () => {
    expect(parseSmartQuery("tutores Ana")).toEqual({
      type: "parents",
      term: "Ana",
    });
  });

  it("is case-insensitive", () => {
    expect(parseSmartQuery("ALUMNOS DEL GRUPO C")).toEqual({
      type: "students_by_group",
      term: "C",
    });
  });

  it("returns null for a plain name with no recognized shape", () => {
    expect(parseSmartQuery("María Fernanda")).toBeNull();
  });

  it("returns null for an empty or whitespace-only query", () => {
    expect(parseSmartQuery("   ")).toBeNull();
  });

  it("returns null when the pattern matches but leaves no term", () => {
    expect(parseSmartQuery("alumnos del grupo")).toBeNull();
  });
});
