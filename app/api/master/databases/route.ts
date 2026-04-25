/**
 * Master Databases API — ดึงรายการ spreadsheets ทั้งหมดของ client
 * path: app/api/master/databases/route.ts
 *
 * GET /api/master/databases
 *   → อ่าน client_db จาก Master sheet แล้วคืน spreadsheets[] ของ client นั้น
 *   → ใช้ใน Admin หน้า Master Data เพื่อเลือก spreadsheet ที่จะจัดการ
 *
 * ✅ ใช้ SA — ไม่พึ่ง OAuth token ของ user
 * ✅ Cache 5 นาที (ลด quota)
 * ✅ รองรับ ?refresh=true เพื่อ bypass cache
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

const dbCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    // Lookup clientId from client_user via SA
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow)
      return NextResponse.json({ error: "Client not found", code: "CLIENT_NOT_FOUND" }, { status: 404 });

    const clientId = (userRow[0] ?? "").toString().trim();

    // Cache check
    const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";
    const cacheKey = `db:${clientId}`;
    if (!forceRefresh) {
      const cached = dbCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION)
        return NextResponse.json({ ...cached.data, cached: true });
    } else {
      dbCache.delete(cacheKey);
    }

    // Fetch client_db via SA
    const dbRows = await saReadRange(MASTER_SHEET_ID, "client_db!A:E");

    const databases = dbRows
      .slice(1)
      .filter((row) => {
        const dbClientId = (row[1] ?? "").toString();
        const sheetName  = (row[2] ?? "").toString().trim();
        const configName = (row[4] ?? "").toString().trim();
        return dbClientId === clientId && sheetName !== "" && configName !== "";
      })
      .map((row) => {
        let spreadsheetId = (row[3] ?? "").toString();
        if (spreadsheetId.includes("/edit")) spreadsheetId = spreadsheetId.split("/edit")[0];
        if (spreadsheetId.includes("?"))    spreadsheetId = spreadsheetId.split("?")[0];
        return {
          databaseId:   (row[0] ?? "").toString(),
          clientId:     (row[1] ?? "").toString(),
          sheetName:    (row[2] ?? "").toString(),
          spreadsheetId,
          configName:   (row[4] ?? "").toString(),
        };
      });

    console.log(`✅ [${requestId}] Found ${databases.length} databases for ${clientId}`);

    const result = { success: true, databases, totalDatabases: databases.length };
    dbCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR", message: error.message }, { status: 500 });
  }
}
