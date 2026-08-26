import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

const ADMIN_ROLES = new Set<Role>(["ADMIN", "STAFF"]);
const PORTAL_ROLES = new Set<Role>(["TEACHER", "STUDENT", "PARENT"]);

export type RouteGuardDecision = "allow" | "/login" | "/admin" | "/portal";

/**
 * Pure routing decision for the /admin and /portal areas, extracted so it can be
 * unit tested without going through the `auth()` middleware wrapper.
 */
export function decideRouteGuard(pathname: string, role: string | undefined): RouteGuardDecision {
  if (!role) {
    return "/login";
  }

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.has(role as Role)) {
    return "/portal";
  }

  if (pathname.startsWith("/portal") && !PORTAL_ROLES.has(role as Role)) {
    return "/admin";
  }

  return "allow";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  const decision = decideRouteGuard(pathname, role);

  if (decision === "/login") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (decision === "/admin") {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  if (decision === "/portal") {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
