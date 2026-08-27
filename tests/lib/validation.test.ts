import { describe, it, expect } from "vitest";
import { isValidEmail } from "@/lib/validation";

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
