/**
 * lib/verify-sheet-access.ts
 *
 * Shared utility: ตรวจสอบว่า user มีสิทธิ์เข้าถึง spreadsheetId นั้นจริงมั้ย
 * — Cache ผลไว้ 5 นาทีต่อ email เพื่อลด API calls
 * — Scope cache key ด้วย email (ไม่ข้ามบริษัท)
 */

import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

// ── Cache: email → { clientId, ownedSheetIds, expiry } ────────────────────────
interface AccessEntry {
  clientId: string;
  ownedSheetIds: Set<string>;
  expiry: number;
}

const MAX_CACHE_SIZE = 500;
const ACCESS_TTL = 5 * 60 * 1000; // 5 นาที
const _accessCache = new Map<string, AccessEntry>();

function evictOldest() {
  if (_accessCache.size < MAX_CACHE_SIZE) return;
  const firstKey = _accessCache.keys().next().value;
  if (firstKey) _accessCache.delete(firstKey);
}

/**
 * ดึง clientId และ spreadsheetIds ทั้งหมดที่ client นั้นเป็นเจ้าของ
 * — Cache ไว้ 5 นาที ต่อ email
 */
async function getAccessEntry(userEmail: string): Promise<AccessEntry | null> {
  const now = Date.now();
  const cached = _accessCache.get(userEmail);
  if (cached && now < cached.expiry) return cached;

  try {
    const [userRows, dbRows, modRows, crmRows] = await Promise.all([
      saReadRange(MASTER_SHEET_ID, "client_user!A:E"),
      saReadRange(MASTER_SHEET_ID, "client_db!A:E").catch(() => [] as any[][]),
      saReadRange(MASTER_SHEET_ID, "client_modules!A:H").catch(() => [] as any[][]),
      saReadRange(MASTER_SHEET_ID, "client_crm!A:H").catch(() => [] as any[][]),
    ]);

    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return null;

    const clientId = (userRow[0] ?? "").toString().trim();

    const ownedSheetIds = new Set<string>();

    // จาก client_db: col A=databaseId, col B=clientId, col D=spreadsheetId
    dbRows.slice(1).forEach((r) => {
      if ((r[1] ?? "").toString().trim() !== clientId) return;
      const raw = (r[3] ?? "").toString().trim();
      if (raw) ownedSheetIds.add(extractSheetId(raw));
    });

    // จาก client_modules: col A=moduleId, col B=clientId, col D=spreadsheetId
    modRows.slice(1).forEach((r) => {
      if ((r[1] ?? "").toString().trim() !== clientId) return;
      const raw = (r[3] ?? "").toString().trim();
      if (raw) ownedSheetIds.add(extractSheetId(raw));
    });

    // จาก client_crm: ใช้ header-based (crm_id, client_id, module_name, spreadsheet_id, ...)
    if (crmRows.length > 1) {
      const crmHeaders = crmRows[0].map((h: string) => (h ?? "").toString().toLowerCase().trim());
      const crmClientCol = crmHeaders.indexOf("client_id");
      const crmSheetCol  = crmHeaders.indexOf("spreadsheet_id");
      crmRows.slice(1).forEach((r) => {
        if (crmClientCol === -1 || crmSheetCol === -1) return;
        if ((r[crmClientCol] ?? "").toString().trim() !== clientId) return;
        const raw = (r[crmSheetCol] ?? "").toString().trim();
        if (raw) ownedSheetIds.add(extractSheetId(raw));
      });
    }

    const entry: AccessEntry = { clientId, ownedSheetIds, expiry: now + ACCESS_TTL };
    evictOldest();
    _accessCache.set(userEmail, entry);
    return entry;
  } catch {
    return null;
  }
}

function extractSheetId(raw: string): string {
  let id = raw.trim();
  if (id.includes("/edit")) id = id.split("/edit")[0];
  if (id.includes("?")) id = id.split("?")[0];
  const match = id.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return id;
}

/**
 * ตรวจสอบว่า userEmail มีสิทธิ์เข้าถึง spreadsheetId นั้นมั้ย
 * Returns: { allowed: true, clientId } หรือ { allowed: false }
 */
export async function verifySheetAccess(
  userEmail: string,
  spreadsheetId: string
): Promise<{ allowed: boolean; clientId?: string }> {
  const entry = await getAccessEntry(userEmail);
  if (!entry) return { allowed: false };

  // SUPER_ADMIN: ตรวจว่า role ใน master sheet
  // ถ้าต้องการ SUPER_ADMIN bypass ให้เพิ่ม role check ที่นี่

  if (entry.ownedSheetIds.has(spreadsheetId)) {
    return { allowed: true, clientId: entry.clientId };
  }
  return { allowed: false };
}

/**
 * ดึงแค่ clientId สำหรับ user (ไม่ check spreadsheet)
 */
export async function getClientId(userEmail: string): Promise<string | null> {
  const entry = await getAccessEntry(userEmail);
  return entry?.clientId ?? null;
}

/**
 * ดึง clientId + spreadsheetIds ทั้งหมดที่ client เป็นเจ้าของ
 * รวม client_db, client_modules, client_crm
 */
export async function getOwnedSheetIds(
  userEmail: string
): Promise<{ clientId: string; sheetIds: string[] } | null> {
  const entry = await getAccessEntry(userEmail);
  if (!entry) return null;
  return { clientId: entry.clientId, sheetIds: [...entry.ownedSheetIds] };
}

/**
 * Invalidate cache ของ user (เรียกเมื่อ update permissions)
 */
export function invalidateAccessCache(userEmail: string) {
  _accessCache.delete(userEmail);
}
