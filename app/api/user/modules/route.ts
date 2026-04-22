/**
 * User Modules API
 * Location: app/api/user/modules/route.ts
 *
 * ✅ รองรับ multi-user (admin + staff) พร้อมกัน
 * ✅ ใช้ SA อ่าน sheet ทั้งหมด — ไม่กิน quota user, ไม่ depend on OAuth token
 * ✅ Lookup user จาก client_user ก่อน → ได้ clientId → หา client_master ด้วย clientId
 * ✅ Server-side cache + thundering-herd guard
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

// ─── SA-based cache (ไม่ต้องใช้ accessToken เป็น key) ──────────────────────
interface CacheEntry {
  rows: any[][];
  expiry: number;
  pending?: Promise<any[][]>;
}
const MAX_SA_CACHE = 50;
const _saCache = new Map<string, CacheEntry>();

function evictOldestSa() {
  if (_saCache.size < MAX_SA_CACHE) return;
  const firstKey = _saCache.keys().next().value;
  if (firstKey) _saCache.delete(firstKey);
}

async function saGetCachedRows(range: string, ttlMs: number): Promise<any[][]> {
  const now = Date.now();
  const entry = _saCache.get(range);

  if (entry && now < entry.expiry) return entry.rows;
  if (entry?.pending) return entry.pending;

  const pending: Promise<any[][]> = saReadRange(MASTER_SHEET_ID, range)
    .then((rows) => {
      evictOldestSa();
      _saCache.set(range, { rows, expiry: Date.now() + ttlMs });
      return rows;
    })
    .catch((err) => {
      const e = _saCache.get(range);
      _saCache.set(range, { rows: e?.rows ?? [], expiry: e?.expiry ?? 0 });
      throw err;
    });

  _saCache.set(range, {
    rows: entry?.rows ?? [],
    expiry: entry?.expiry ?? 0,
    pending,
  });

  return pending;
}

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    // 1. ตรวจ session — ใช้ JWT เพื่อเอา email เท่านั้น
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.email) {
      return NextResponse.json({ error: "Not authenticated", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    if ((token as any).error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Session expired", code: "TOKEN_EXPIRED", message: "Please sign out and sign in again" },
        { status: 401 }
      );
    }

    const userEmail = (token.email as string).toLowerCase().trim();
    console.log(`📡 [${requestId}] modules request — email: ${userEmail}`);

    if (!MASTER_SHEET_ID) {
      return NextResponse.json({ error: "Configuration error", code: "CONFIG_ERROR" }, { status: 500 });
    }

    // 2. อ่านทุก sheet ผ่าน SA พร้อมกัน
    const [userRows, masterRows, modulesRows, dashboardRows] = await Promise.all([
      saGetCachedRows("client_user!A:E",      5 * 60 * 1000),
      saGetCachedRows("client_master!A:H",   10 * 60 * 1000),
      saGetCachedRows("client_modules!A:H",   5 * 60 * 1000),
      saGetCachedRows("client_dashboard!A:I", 5 * 60 * 1000).catch(() => [] as any[][]),
    ]);

    console.log(`✅ [${requestId}] SA fetch — users:${userRows.length} master:${masterRows.length} modules:${modulesRows.length}`);

    // 3. หา clientId จาก client_user (รองรับทั้ง admin และ staff)
    //    client_user columns: A=client_id, B=user_email, C=role, D=is_active, E=notes
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );

    if (!userRow) {
      console.error(`❌ [${requestId}] email not found in client_user: ${userEmail}`);
      return NextResponse.json({ error: "User not found in system", code: "USER_NOT_FOUND" }, { status: 404 });
    }

    const clientId = (userRow[0] ?? "").toString().trim();
    const isActive = (userRow[3] ?? "").toString().toUpperCase() === "TRUE";

    if (!isActive) {
      return NextResponse.json({ error: "Account is inactive", code: "ACCOUNT_INACTIVE" }, { status: 403 });
    }

    console.log(`✅ [${requestId}] clientId: ${clientId}`);

    // 4. หาข้อมูล plan/status จาก client_master ด้วย clientId (column A = index 0)
    //    client_master columns: A=client_id, B=client_name, C=admin_email, D=plan_type,
    //                           E=status, F=start_date, G=expires_at, H=modules
    const clientRow = masterRows.slice(1).find(
      (r) => (r[0] ?? "").toString().trim() === clientId
    );

    if (!clientRow) {
      console.error(`❌ [${requestId}] clientId ${clientId} not found in client_master`);
      return NextResponse.json({ error: "Client not configured", code: "CLIENT_NOT_FOUND" }, { status: 403 });
    }

    const clientName  = (clientRow[1] ?? "").toString();
    const planType    = (clientRow[3] ?? "").toString();
    const status      = (clientRow[4] ?? "").toString();
    const expiresAt   = (clientRow[6] ?? "").toString();
    const modulesStr  = (clientRow[7] ?? "ERP").toString();
    const hasCRM      = modulesStr.includes("CRM");
    const hasHRM      = modulesStr.includes("HRM");
    const crmExpiresAt = hasCRM ? expiresAt : null;

    if (status.toUpperCase() !== "TRUE" && status.toUpperCase() !== "ACTIVE") {
      return NextResponse.json({ error: "Account is inactive", code: "ACCOUNT_INACTIVE" }, { status: 403 });
    }

    const expireDate = parseDate(expiresAt);
    if (expireDate && expireDate < new Date()) {
      return NextResponse.json({ error: "Subscription expired", code: "SUBSCRIPTION_EXPIRED" }, { status: 403 });
    }

    // 5. Filter modules ตาม clientId
    const modules = modulesRows
      .slice(1)
      .filter((row) => {
        const mClientId  = (row[1] ?? "").toString().trim();
        const isActive   = (row[6] ?? "").toString().toUpperCase() === "TRUE";
        const configName = (row[5] ?? "").toString().trim();
        return mClientId === clientId && isActive && configName !== "";
      })
      .map((row) => ({
        moduleId:      (row[0] ?? "").toString(),
        moduleName:    (row[2] ?? "").toString(),
        spreadsheetId: (row[3] ?? "").toString(),
        sheetName:     (row[4] ?? "").toString(),
        configName:    (row[5] ?? "").toString(),
        notes:         (row[7] ?? "").toString(),
      }));

    // 6. Filter dashboard items ตาม clientId
    const dashboardItems = dashboardRows
      .slice(1)
      .filter((row) => {
        const mClientId  = (row[1] ?? "").toString().trim();
        const isActive   = (row[6] ?? "").toString().toUpperCase() === "TRUE";
        const configName = (row[5] ?? "").toString().trim();
        return mClientId === clientId && isActive && configName !== "";
      })
      .map((row) => ({
        dashboardId:         (row[0] ?? "").toString(),
        dashboardName:       (row[2] ?? "").toString(),
        spreadsheetId:       (row[3] ?? "").toString(),
        sheetName:           (row[4] ?? "").toString(),
        dashboardConfigName: (row[5] ?? "").toString(),
        notes:               (row[7] ?? "").toString(),
        archiveFolderId:     (row[8] ?? "").toString(),
      }));

    console.log(`✅ [${requestId}] modules:${modules.length} dashboards:${dashboardItems.length} hasCRM:${hasCRM}`);

    return NextResponse.json(
      { clientId, clientName, planType, expiresAt, hasCRM, crmExpiresAt, hasHRM, modules, dashboardItems },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=60" } }
    );

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR: ${error.message}`);
    return NextResponse.json(
      { error: "Server error", code: "INTERNAL_ERROR", message: error.message },
      { status: 500 }
    );
  }
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    if (dateStr.includes("/")) {
      const [month, day, year] = dateStr.split("/").map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}
