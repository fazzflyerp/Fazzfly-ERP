/**
 * Middleware - Console Logging Only (Edge Runtime Compatible) ✅
 * Location: middleware.ts
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// ✅ ลบ fs และ path imports ออกทั้งหมด

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const LANDING_ONLY_PATHS = ["/", "/contact", "/pricing", "/solution"];

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const path = request.nextUrl.pathname;
  const method = request.method;
  const timestamp = new Date().toISOString();
  const hostname = request.headers.get("host") ?? "";

  // ✅ Skip static files
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/favicon") ||
    path.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // บล็อก ERP routes บน fazzfly.com — ให้แค่ landing page เท่านั้น
  const isFazzflydomain = hostname.includes("fazzfly.com") && !hostname.includes("app.fazzfly");
  if (isFazzflydomain && !LANDING_ONLY_PATHS.includes(path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // บน poffclinic.com — redirect / ไป /login
  const isPoffDomain = hostname.includes("poffclinic.com");
  if (isPoffDomain && path === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let userEmail: string | undefined;
  
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (token) {
      userEmail = (token as any)?.email;
    }
  } catch (error) {
    // Silent fail
  }

  // ✅ Console log only
  const user = userEmail ? `[${userEmail}]` : "[anonymous]";
  console.log(`[${timestamp}] [${requestId}] ${method} ${path} ${user}`);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-request-start", startTime.toString());
  if (userEmail) {
    requestHeaders.set("x-user-email", userEmail);
  }

  let response: NextResponse;
  let error: string | undefined;
  
  try {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err: any) {
    error = err.message;
    response = NextResponse.json(
      { 
        error: "Internal server error", 
        requestId,
        message: err.message 
      },
      { status: 500 }
    );
  }

  const duration = Date.now() - startTime;
  const status = response.status;
  const statusColor = status >= 400 ? "\x1b[31m" : "\x1b[32m";
  const reset = "\x1b[0m";

  console.log(
    `${statusColor}[${new Date().toISOString()}] [${requestId}] ${method} ${path} ${user} [${status}] (${duration}ms)${reset}`
  );

  if (error) {
    console.error(`  ❌ Error: ${error}`);
  }

  response.headers.set("x-request-id", requestId);
  response.headers.set("x-response-time", `${duration}ms`);

  return response;
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