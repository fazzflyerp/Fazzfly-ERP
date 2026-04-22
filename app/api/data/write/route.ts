/**
 * =============================================================================
 * FILE: app/api/data/write/route.ts
 * =============================================================================
 * POST /api/data/write
 *
 * Generic SA write endpoint — appends a row to any module's spreadsheet
 * โดยอ้างอิง client_id + module_name จาก client_modules sheet
 *
 * Request body:
 *   {
 *     moduleName: string,       // ชื่อ module ตาม client_modules.module_name (e.g. "receipt")
 *     sheetName?: string,       // override sheet tab (ถ้าไม่ส่ง ใช้ค่าจาก client_modules)
 *     row: any[],               // array of values สำหรับแถวที่จะ append
 *     prependTimestamp?: bool,  // default true — เพิ่ม timestamp + email ต้นแถว
 *   }
 *
 * Response:
 *   { ok: true, updatedRange: string }  |  { error: string, code: string }
 *
 * Flow:
 *   1. ตรวจ session (NextAuth JWT)
 *   2. อ่าน client_user → ได้ clientId + role
 *   3. อ่าน client_modules → หา row ที่ clientId + moduleName ตรงกัน
 *   4. saAppendRow ด้วย SA (ไม่กิน quota user)
 *
 * client_modules columns (A:H):
 *   A: module_id | B: client_id | C: module_name | D: spreadsheet_id
 *   E: sheet_name | F: config_name | G: is_active | H: notes
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saAppendRow } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

// ─── Cache: clientId lookup (TTL 5 min) ─────────────────────────────────────
interface UserEntry { clientId: string; role: string; expiry: number }
const _userCache = new Map<string, UserEntry>(); // key = email
const USER_TTL   = 5 * 60 * 1000;

// ─── Cache: module lookup (TTL 5 min) ────────────────────────────────────────
interface ModuleEntry {
  spreadsheetId: string;
  sheetName: string;
  expiry: number;
}
const _moduleCache = new Map<string, ModuleEntry>(); // key = `${clientId}:${moduleName}`
const MOD_TTL = 5 * 60 * 1000;

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. ตรวจ session
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    const email = (token.email as string).toLowerCase().trim();

    // 2. อ่าน body
    let body: {
      moduleName?: string;
      sheetName?: string;
      row?: any[];
      prependTimestamp?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
    }

    const { moduleName, row, prependTimestamp = true } = body;
    const sheetNameOverride = body.sheetName;

    if (!moduleName || !Array.isArray(row)) {
      return NextResponse.json(
        { error: "moduleName and row[] are required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 3. หา clientId จาก cache หรือ client_user sheet
    let clientId: string;
    const cached = _userCache.get(email);
    if (cached && Date.now() < cached.expiry) {
      clientId = cached.clientId;
    } else {
      const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
      const found = userRows.slice(1).find(
        (r) => (r[1] ?? "").toString().toLowerCase().trim() === email
      );
      if (!found) {
        return NextResponse.json({ error: "User not found", code: "USER_NOT_FOUND" }, { status: 403 });
      }
      const isActive = (found[3] ?? "").toString().toUpperCase() === "TRUE";
      if (!isActive) {
        return NextResponse.json({ error: "Account is inactive", code: "ACCOUNT_INACTIVE" }, { status: 403 });
      }
      clientId = (found[0] ?? "").toString().trim();
      const role = (found[2] ?? "STAFF").toString().trim().toUpperCase();
      _userCache.set(email, { clientId, role, expiry: Date.now() + USER_TTL });
    }

    // 4. หา spreadsheetId + sheetName จาก client_modules
    const modCacheKey = `${clientId}:${moduleName.toLowerCase()}`;
    let spreadsheetId: string;
    let sheetName: string;

    const cachedMod = _moduleCache.get(modCacheKey);
    if (cachedMod && Date.now() < cachedMod.expiry) {
      spreadsheetId = cachedMod.spreadsheetId;
      sheetName     = sheetNameOverride ?? cachedMod.sheetName;
    } else {
      const modRows = await saReadRange(MASTER_SHEET_ID, "client_modules!A:H");
      const modRow = modRows.slice(1).find((r) => {
        const mClientId   = (r[1] ?? "").toString().trim();
        const mModuleName = (r[2] ?? "").toString().trim().toLowerCase();
        const isActive    = (r[6] ?? "").toString().toUpperCase() === "TRUE";
        return mClientId === clientId && mModuleName === moduleName.toLowerCase() && isActive;
      });

      if (!modRow) {
        return NextResponse.json(
          { error: `Module "${moduleName}" not found or inactive`, code: "MODULE_NOT_FOUND" },
          { status: 404 }
        );
      }

      spreadsheetId = (modRow[3] ?? "").toString().trim();
      const defaultSheet = (modRow[4] ?? "").toString().trim();

      if (!spreadsheetId) {
        return NextResponse.json(
          { error: "Module has no spreadsheetId configured", code: "CONFIG_ERROR" },
          { status: 500 }
        );
      }

      _moduleCache.set(modCacheKey, {
        spreadsheetId,
        sheetName: defaultSheet,
        expiry: Date.now() + MOD_TTL,
      });

      sheetName = sheetNameOverride ?? defaultSheet;
    }

    // 5. Build final row (timestamp + email ต้นแถว ถ้า prependTimestamp)
    const now = new Date().toISOString();
    const finalRow = prependTimestamp ? [now, email, ...row] : row;

    // 6. Append via SA
    const range = sheetName ? `${sheetName}!A:A` : "A:A";
    await saAppendRow(spreadsheetId, range, finalRow);

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error("❌ [data/write] Error:", error.message);
    return NextResponse.json(
      { error: "Write failed", code: "INTERNAL_ERROR", message: error.message },
      { status: 500 }
    );
  }
}
