import { describe, it, expect } from "vitest";
import { decideRouteGuard } from "@/proxy";

describe("decideRouteGuard", () => {
  it("sends unauthenticated users to /login from /admin", () => {
    expect(decideRouteGuard("/admin/x", undefined)).toBe("/login");
  });

  it("sends unauthenticated users to /login from /portal", () => {
    expect(decideRouteGuard("/portal/x", undefined)).toBe("/login");
  });

  for (const role of ["ADMIN", "STAFF"]) {
    it(`allows ${role} on /admin`, () => {
      expect(decideRouteGuard("/admin/x", role)).toBe("allow");
    });

    it(`redirects ${role} away from /portal to /admin`, () => {
      expect(decideRouteGuard("/portal/x", role)).toBe("/admin");
    });
  }

  for (const role of ["TEACHER", "STUDENT", "PARENT"]) {
    it(`allows ${role} on /portal`, () => {
      expect(decideRouteGuard("/portal/x", role)).toBe("allow");
    });

    it(`redirects ${role} away from /admin to /portal`, () => {
      expect(decideRouteGuard("/admin/x", role)).toBe("/portal");
    });
  }
});
