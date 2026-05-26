/**
 * GET /api/user/modules-demo
 * DEMO version of modules API — allows modules with empty configName through
 * (e.g. Finance module that has configName blank in client_modules)
 * Never modifies the production /api/user/modules endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

interface CacheEntry {
  rows: any[][];
  expiry: number;
  pending?: Promise<any[][]>;
}
const MAX_SA_CACHE = 50;
const _saCache = new Map<string, CacheEntry>();

function evictOldest() {
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
      evictOldest();
      _saCache.set(range, { rows, expiry: Date.now() + ttlMs });
      return rows;
    })
    .catch((err) => {
      const e = _saCache.get(range);
      _saCache.set(range, { rows: e?.rows ?? [], expiry: e?.expiry ?? 0 });
      throw err;
    });

  _saCache.set(range, { rows: entry?.rows ?? [], expiry: entry?.expiry ?? 0, pending });
  return pending;
}

function isKnownDemoType(row: any[]): boolean {
  const n = (row[2] ?? "").toString().toUpperCase();
  const s = (row[4] ?? "").toString().toUpperCase();
  // Allow Finance, INV_BRANCH, INV_CENTRAL through even without configName
  return (
    n.startsWith("FINANC") || s.startsWith("FINANC") ||
    n === "INV_BRANCH" || n === "INV_CENTRAL"
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email)
      return NextResponse.json({ error: "Not authenticated", code: "AUTH_REQUIRED" }, { status: 401 });

    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = (token.email as string).toLowerCase().trim();

    if (!MASTER_SHEET_ID)
      return NextResponse.json({ error: "Configuration error", code: "CONFIG_ERROR" }, { status: 500 });

    const [userRows, masterRows, modulesRows, dashboardRows] = await Promise.all([
      saGetCachedRows("client_user!A:E",        5 * 60 * 1000),
      saGetCachedRows("client_master!A:H",     10 * 60 * 1000),
      saGetCachedRows("client_modules!A:H",     5 * 60 * 1000),
      saGetCachedRows("client_dashboard!A:I",   5 * 60 * 1000).catch(() => [] as any[][]),
    ]);

    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow)
      return NextResponse.json({ error: "User not found in system", code: "USER_NOT_FOUND" }, { status: 404 });

    const clientId = (userRow[0] ?? "").toString().trim();
    const isActive = (userRow[3] ?? "").toString().toUpperCase() === "TRUE";
    if (!isActive)
      return NextResponse.json({ error: "Account is inactive", code: "ACCOUNT_INACTIVE" }, { status: 403 });

    const clientRow = masterRows.slice(1).find(
      (r) => (r[0] ?? "").toString().trim() === clientId
    );
    if (!clientRow)
      return NextResponse.json({ error: "Client not configured", code: "CLIENT_NOT_FOUND" }, { status: 403 });

    const clientName = (clientRow[1] ?? "").toString();
    const status     = (clientRow[4] ?? "").toString();
    const expiresAt  = (clientRow[6] ?? "").toString();

    if (status.toUpperCase() !== "TRUE" && status.toUpperCase() !== "ACTIVE")
      return NextResponse.json({ error: "Account is inactive", code: "ACCOUNT_INACTIVE" }, { status: 403 });

    // Filter modules — allow empty configName for known DEMO module types
    const modules = modulesRows
      .slice(1)
      .filter((row) => {
        const mClientId  = (row[1] ?? "").toString().trim();
        const rowActive  = (row[6] ?? "").toString().toUpperCase() === "TRUE";
        const configName = (row[5] ?? "").toString().trim();
        if (!rowActive || mClientId !== clientId) return false;
        return configName !== "" || isKnownDemoType(row);
      })
      .map((row) => ({
        moduleId:      (row[0] ?? "").toString(),
        moduleName:    (row[2] ?? "").toString(),
        spreadsheetId: (row[3] ?? "").toString(),
        sheetName:     (row[4] ?? "").toString(),
        configName:    (row[5] ?? "").toString(),
        notes:         (row[7] ?? "").toString(),
      }));

    function extractFolderId(raw: string): string {
      const trimmed = raw.trim();
      const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : trimmed;
    }

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
        archiveFolderId:     extractFolderId((row[8] ?? "").toString()),
      }));

    return NextResponse.json(
      { clientId, clientName, expiresAt, modules, dashboardItems },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 });
  }
}
