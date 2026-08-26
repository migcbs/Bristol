import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

const ADMIN_ROLES = new Set<Role>(["ADMIN", "STAFF"]);
const PORTAL_ROLES = new Set<Role>(["TEACHER", "STUDENT", "PARENT"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  if (!role) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && !ADMIN_ROLES.has(role)) {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  if (pathname.startsWith("/portal") && !PORTAL_ROLES.has(role)) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
