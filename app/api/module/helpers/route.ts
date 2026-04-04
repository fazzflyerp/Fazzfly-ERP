/**
 * Helper/Dropdown Options API
 * Location: app/api/module/helpers/route.ts
 * 
 * ✅ No in-memory cache (Vercel serverless = multiple instances)
 * ✅ ใช้ HTTP Cache-Control แทน (CDN/browser cache 60s)
 * ✅ รองรับ ?bust=1 เพื่อ force refresh
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      if (response.ok || response.status === 404) return response;
      if (response.status >= 500 && i < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      return response;
    } catch (error: any) {
      if (error.name === "TimeoutError" || i === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

async function _GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const accessToken = (token as any)?.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No access token", code: "NO_TOKEN" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = searchParams.get("spreadsheetId");
    const helperName    = searchParams.get("helperName");
    // ✅ ?bust=xxx → force bypass CDN cache (ไม่ต้องทำอะไรใน code แค่ทำให้ URL ต่างกัน)

    if (!spreadsheetId || !helperName)
      return NextResponse.json({ error: "Missing parameters", code: "MISSING_PARAMS" }, { status: 400 });

    console.log(`📋 [${requestId}] Helper: ${helperName}`);

    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(helperName)}!A:C`;

    let response: Response;
    try {
      response = await fetchWithRetry(sheetsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    } catch (error: any) {
      return NextResponse.json({ error: "Failed to fetch helper data", code: "FETCH_ERROR", message: error.message }, { status: 500 });
    }

    if (!response.ok) {
      if (response.status === 401)
        return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

      // Sheet not found → return empty (ไม่ error)
      return NextResponse.json(
        { success: true, helperName, options: [], totalOptions: 0, warning: `Helper sheet "${helperName}" not found` },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
      );
    }

    const data  = await response.json();
    const rows  = data.values || [];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: true, helperName, options: [], totalOptions: 0, warning: `Helper sheet "${helperName}" is empty` },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
      );
    }

    const options = rows.slice(1)
      .filter((row: any[]) => row[0])
      .map((row: any[]) => {
        const value  = row[0]?.toString() || "";
        const name   = row[1]?.toString() || "";
        const detail = row[2]?.toString() || "";
        return { value, label: detail ? `${name} - ${detail}` : name };
      });

    console.log(`✅ [${requestId}] Loaded ${options.length} options`);

    return NextResponse.json(
      { success: true, helperName, options, totalOptions: options.length },
      {
        headers: {
          // ✅ CDN/browser cache 60s, แต่ serve stale ได้อีก 30s ระหว่าง revalidate
          // → ผู้ใช้เห็นข้อมูลใหม่ภายใน 1-2 นาที โดยไม่มี cold start
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
export const GET = withLogger("/api/module/helpers", _GET);