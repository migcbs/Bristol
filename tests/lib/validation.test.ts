import { describe, it, expect } from "vitest";
import { isValidEmail, isValidCurp } from "@/lib/validation";

describe("isValidEmail", () => {
  it("accepts a well-formed email", () => {
    expect(isValidEmail("persona@bristol-ingles.com")).toBe(true);
  });

  it("rejects a string with no @", () => {
    expect(isValidEmail("persona-bristol.com")).toBe(false);
  });

  it("rejects a string with no domain", () => {
    expect(isValidEmail("persona@")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidCurp", () => {
  it("accepts a well-formed CURP", () => {
    expect(isValidCurp("GARC120101HVZRRL09")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidCurp("garc120101hvzrrl09")).toBe(true);
  });

  it("rejects a CURP that's too short", () => {
    expect(isValidCurp("GARC120101HVZRRL0")).toBe(false);
  });

  it("rejects a CURP with an invalid sex letter", () => {
    expect(isValidCurp("GARC120101XVZRRL09")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidCurp("")).toBe(false);
  });
});
