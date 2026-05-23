/**
 * lib/inv-access.ts
 * INV access control helper
 * — ดึง role + branchId + spreadsheet IDs สำหรับ INV system
 */

import { saReadRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export interface BranchSheet {
  branchId: string;
  branchName: string;
  sheetId: string;
}

export interface InvAccess {
  role: string;
  branchId: string | null;
  branchName: string | null;
  centralSheetId: string | null;
  branchSheetId: string | null;
  allBranchSheets: BranchSheet[];
  dbSheetId: string | null;
  clientId: string;
}

interface CacheEntry {
  data: InvAccess;
  expiry: number;
}

const _cache = new Map<string, CacheEntry>();
const TTL = 5 * 60 * 1000;

function extractId(raw: string): string {
  const match = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return raw.trim().split("/edit")[0].split("?")[0].trim();
}

export async function getInvAccess(email: string): Promise<InvAccess | null> {
  const now = Date.now();
  const cached = _cache.get(email);
  if (cached && now < cached.expiry) return cached.data;

  const [userRows, modulesRows, dbRows] = await Promise.all([
    saReadRange(MASTER_SHEET_ID, "client_user!A:H"),
    saReadRange(MASTER_SHEET_ID, "client_modules!A:H"),
    saReadRange(MASTER_SHEET_ID, "client_db!A:D").catch(() => [] as any[][]),
  ]);

  // client_user: A=client_id, B=email, C=role, D=is_active, G=branch_id, H=branch_name
  const userRow = userRows.slice(1).find(
    (r) => (r[1] ?? "").toString().toLowerCase().trim() === email
  );
  if (!userRow) return null;

  const clientId   = (userRow[0] ?? "").toString().trim();
  const role       = (userRow[2] ?? "STAFF").toString().trim().toUpperCase();
  const branchId   = (userRow[6] ?? "").toString().trim() || null;
  const branchName = (userRow[7] ?? "").toString().trim() || null;

  // client_modules: A=moduleId, B=clientId, C=moduleName, D=spreadsheetId, E=sheetName, F=configName, G=isActive, H=notes
  const clientMods = modulesRows.slice(1).filter(
    (r) =>
      (r[1] ?? "").toString().trim() === clientId &&
      (r[6] ?? "").toString().toUpperCase() === "TRUE"
  );

  const centralMod = clientMods.find(
    (r) => (r[2] ?? "").toString().trim().toUpperCase() === "INV_CENTRAL"
  );
  const centralSheetId = centralMod
    ? extractId((centralMod[3] ?? "").toString())
    : null;

  const branchMods = clientMods.filter(
    (r) => (r[2] ?? "").toString().trim().toUpperCase() === "INV_BRANCH"
  );

  // Build branch name map from client_user (same client)
  const branchNameMap = new Map<string, string>();
  userRows.slice(1).forEach((r) => {
    if ((r[0] ?? "").toString().trim() !== clientId) return;
    const bid   = (r[6] ?? "").toString().trim();
    const bname = (r[7] ?? "").toString().trim();
    if (bid && bname && !branchNameMap.has(bid)) branchNameMap.set(bid, bname);
  });

  const allBranchSheets: BranchSheet[] = branchMods.map((r) => {
    const bId   = (r[5] ?? "").toString().trim(); // configName = branch_id
    const bName =
      branchNameMap.get(bId) ||
      (r[7] ?? "").toString().trim() ||
      bId;
    return {
      branchId: bId,
      branchName: bName,
      sheetId: extractId((r[3] ?? "").toString()),
    };
  });

  const myBranch      = allBranchSheets.find((b) => b.branchId === branchId);
  const branchSheetId = myBranch?.sheetId ?? null;

  // client_db: A=dbId, B=clientId, C=?, D=spreadsheetId
  const dbRow    = dbRows.slice(1).find((r) => (r[1] ?? "").toString().trim() === clientId);
  const dbSheetId = dbRow ? extractId((dbRow[3] ?? "").toString()) : null;

  const data: InvAccess = {
    role,
    branchId,
    branchName,
    centralSheetId,
    branchSheetId,
    allBranchSheets,
    dbSheetId,
    clientId,
  };

  _cache.set(email, { data, expiry: now + TTL });
  return data;
}

export function invalidateInvCache(email: string) {
  _cache.delete(email);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function thaiTimestamp(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function todayStr(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export async function genId(
  prefix: string,
  sheetId: string,
  sheetName: string
): Promise<string> {
  const today = todayStr();
  const pfx   = `${prefix}-${today}-`;
  const rows  = await saReadRange(sheetId, `${sheetName}!A:A`, 0);
  const count = rows.slice(1).filter((r) => (r[0] ?? "").toString().startsWith(pfx)).length;
  return `${pfx}${(count + 1).toString().padStart(3, "0")}`;
}
