import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LANDING_ONLY_PATHS = ["/", "/contact", "/pricing", "/solution"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hostname = request.headers.get("host") ?? "";

  // Skip static files
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/favicon") ||
    path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // บล็อก ERP routes บน fazzfly.com — ให้แค่ landing page
  const isFazzflyDomain = hostname.includes("fazzfly.com") && !hostname.includes("app.fazzfly");
  if (isFazzflyDomain && !LANDING_ONLY_PATHS.includes(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // บน poffclinic.com — redirect / ไป /select-system
  const isPoffDomain = hostname.includes("poffclinic.com");
  if (isPoffDomain && path === "/") {
    return NextResponse.redirect(new URL("/select-system", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
    "/debug/:path*",
    "/login",
    "/ERP/:path*",
    "/CRM/:path*",
    "/tasks",
    "/select-system",
    "/auth-router",
    "/test",
  ],
};
