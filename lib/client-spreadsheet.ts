/**
 * lib/client-spreadsheet.ts
 *
 * หา "Main Spreadsheet" ของ client จาก client_db (URL ที่ admin กรอกไว้)
 * — ใช้ for: Tasks + Activity Log
 * — Cache 10 นาที ต่อ clientId
 */

import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const CACHE_TTL = 10 * 60 * 1000;
const _cache = new Map<string, { id: string; expiry: number }>();

function extractId(raw: string): string {
  let id = raw.trim();
  if (id.includes("/edit")) id = id.split("/edit")[0];
  if (id.includes("?"))     id = id.split("?")[0];
  const match = id.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : id;
}

/**
 * คืน spreadsheetId หลักของ client
 * — ดูจาก client_db ก่อน (row แรกที่ตรง clientId)
 * — fallback → client_modules (module แรกที่ active)
 */
export async function getClientMainSheet(clientId: string): Promise<string | null> {
  const now = Date.now();
  const cached = _cache.get(clientId);
  if (cached && now < cached.expiry) return cached.id;

  try {
    const [dbRows, modRows] = await Promise.all([
      saReadRange(MASTER_SHEET_ID, "client_db!A:E").catch(() => [] as any[][]),
      saReadRange(MASTER_SHEET_ID, "client_modules!A:H").catch(() => [] as any[][]),
    ]);

    // client_db: col A=databaseId, col B=clientId, col D=spreadsheetId
    const dbRow = dbRows.slice(1).find((r) => {
      return (r[1] ?? "").toString().trim() === clientId && (r[3] ?? "").toString().trim() !== "";
    });

    let id: string | null = null;
    if (dbRow) {
      id = extractId((dbRow[3] ?? "").toString());
    } else {
      // fallback: client_modules col B=clientId, col D=spreadsheetId, col G=isActive
      const modRow = modRows.slice(1).find((r) => {
        return (r[1] ?? "").toString().trim() === clientId &&
               (r[3] ?? "").toString().trim() !== "" &&
               (r[6] ?? "").toString().toUpperCase() === "TRUE";
      });
      if (modRow) id = extractId((modRow[3] ?? "").toString());
    }

    if (id) _cache.set(clientId, { id, expiry: now + CACHE_TTL });
    return id;
  } catch {
    return null;
  }
}

export function invalidateClientMainSheet(clientId: string) {
  _cache.delete(clientId);
}
