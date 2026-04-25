/**
 * =============================================================================
 * FILE: lib/google-sa.ts
 * =============================================================================
 * Google Service Account (SA) helper
 * ใช้ SA แทน user token สำหรับ read/write Google Sheets
 * — ไม่กิน quota ของ user
 * — ไม่ต้อง share ไฟล์กับ user แค่ share กับ SA email
 */

import { google, sheets_v4, drive_v3 } from "googleapis";

// ─── SA Auth ─────────────────────────────────────────────────────────────────
function getSAAuth(scopes: string[]) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in env");
  }

  // 1. ตัด surrounding quotes ที่อาจมาจาก .env ("..." หรือ '...')
  let key = rawKey.replace(/^["']|["']$/g, "");

  // 2. แปลง literal \n → newline จริง (กรณี .env เก็บเป็น escape string)
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  // 3. ตรวจสอบว่า key มี BEGIN PRIVATE KEY — ถ้าไม่มีแสดงว่า parse ผิดพลาด
  if (!key.includes("BEGIN PRIVATE KEY") && !key.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY format invalid — missing PEM header");
  }

  return new google.auth.JWT({ email, key, scopes });
}

// ─── Sheets client (cached per process, reset on auth error) ─────────────────
let _sheets: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (!_sheets) {
    _sheets = google.sheets({ version: "v4", auth: getSAAuth(["https://www.googleapis.com/auth/spreadsheets"]) });
  }
  return _sheets;
}

export function resetSheetsClient(): void {
  _sheets = null;
}

// ─── Drive client (cached per process) ──────────────────────────────────────
let _drive: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (!_drive) {
    _drive = google.drive({ version: "v3", auth: getSAAuth(["https://www.googleapis.com/auth/drive"]) });
  }
  return _drive;
}

// ─── Helper: Find folder by name under parent ────────────────────────────────
export async function saFindFolder(folderName: string, parentId: string): Promise<string | null> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

// ─── Helper: Find or create folder ──────────────────────────────────────────
export async function saFindOrCreateFolder(folderName: string, parentId: string): Promise<string> {
  const existing = await saFindFolder(folderName, parentId);
  if (existing) return existing;

  const drive = getDriveClient();
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  return res.data.id!;
}

// ─── Helper: Upload file to Drive via SA ─────────────────────────────────────
export async function saUploadFile(params: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  parentFolderId: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient();
  const { Readable } = require("stream");

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: params.fileName, parents: [params.parentFolderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: "id, webViewLink",
  });

  return { fileId: res.data.id!, webViewLink: res.data.webViewLink! };
}

// ─── In-memory read cache ─────────────────────────────────────────────────────
// Persists for lifetime of warm serverless instance (~10-30 min on Vercel)
// Key: `${spreadsheetId}::${range}`
interface CacheEntry { data: any[][]; ts: number }
const _readCache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 60_000; // 60 วินาที

function _cacheKey(spreadsheetId: string, range: string) {
  return `${spreadsheetId}::${range}`;
}

/** ลบ cache ของ spreadsheet นั้นทั้งหมด (เรียกหลัง write เพื่อไม่ให้ได้ข้อมูลเก่า) */
export function saInvalidateCache(spreadsheetId: string): void {
  for (const key of _readCache.keys()) {
    if (key.startsWith(`${spreadsheetId}::`)) _readCache.delete(key);
  }
}

// ─── Helper: Read range (retry + cache) ──────────────────────────────────────
const RETRYABLE = new Set([401, 403, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;

export async function saReadRange(
  spreadsheetId: string,
  range: string,
  ttl = DEFAULT_TTL   // ttl=0 → bypass cache (ใช้หลัง write)
): Promise<any[][]> {
  const key = _cacheKey(spreadsheetId, range);

  // ── cache hit ──
  if (ttl > 0) {
    const cached = _readCache.get(key);
    if (cached && Date.now() - cached.ts < ttl) return cached.data;
  }

  // ── fetch with retry ──
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const sheets = getSheetsClient();
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const data = res.data.values || [];
      if (ttl > 0) _readCache.set(key, { data, ts: Date.now() });
      return data;
    } catch (err: any) {
      const status = err?.response?.status ?? err?.code;

      if (status === 401 || status === 403) resetSheetsClient();

      const isRetryable =
        RETRYABLE.has(status) ||
        status === "ECONNRESET" ||
        status === "ETIMEDOUT" ||
        status === "ENOTFOUND";

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = Math.min(300 * Math.pow(3, attempt) + Math.random() * 200, 10000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  return [];
}

// ─── Helper: Batch read หลาย range ใน 1 API call ────────────────────────────
// คืน array ลำดับตรงกับ ranges ที่ส่งเข้า
// ranges ที่ cache hit → ไม่โดน quota เลย
export async function saBatchGetRanges(
  spreadsheetId: string,
  ranges: string[],
  ttl = DEFAULT_TTL
): Promise<any[][][]> {
  const now = Date.now();
  const results: (any[][] | null)[] = ranges.map((r) => {
    if (ttl <= 0) return null;
    const cached = _readCache.get(_cacheKey(spreadsheetId, r));
    return cached && now - cached.ts < ttl ? cached.data : null;
  });

  const missing = results.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);

  if (missing.length > 0) {
    const missingRanges = missing.map((i) => ranges[i]);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const sheets = getSheetsClient();
        const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: missingRanges });
        const valueRanges = res.data.valueRanges || [];
        missing.forEach((origIdx, batchIdx) => {
          const data = valueRanges[batchIdx]?.values || [];
          results[origIdx] = data;
          if (ttl > 0) _readCache.set(_cacheKey(spreadsheetId, ranges[origIdx]), { data, ts: now });
        });
        break;
      } catch (err: any) {
        const status = err?.response?.status ?? err?.code;
        if (status === 401 || status === 403) resetSheetsClient();
        const isRetryable = RETRYABLE.has(status) || status === "ECONNRESET" || status === "ETIMEDOUT";
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = Math.min(300 * Math.pow(3, attempt) + Math.random() * 200, 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }

  return results.map((v) => v ?? []);
}

// ─── Helper: Append row ──────────────────────────────────────────────────────
export async function saAppendRow(
  spreadsheetId: string,
  range: string,
  values: any[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

// ─── Helper: Update row ──────────────────────────────────────────────────────
export async function saUpdateRow(
  spreadsheetId: string,
  range: string,
  values: any[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// ─── Helper: Batch update (หลาย range พร้อมกัน) ──────────────────────────────
export async function saBatchUpdate(
  spreadsheetId: string,
  data: { range: string; values: any[][] }[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

// ─── Helper: Append multiple rows ────────────────────────────────────────────
export async function saAppendRows(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

// ─── Helper: Get sheet metadata (sheetId, rowCount) ──────────────────────────
export async function saGetSheetMeta(
  spreadsheetId: string,
  sheetName: string
): Promise<{ sheetId: number; rowCount: number }> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (res.data.sheets || []).find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return {
    sheetId:  sheet.properties!.sheetId!,
    rowCount: sheet.properties!.gridProperties?.rowCount ?? 1000,
  };
}

// ─── Helper: Structural batchUpdate (insertDimension, updateSheetProperties) ─
export async function saStructuralBatchUpdate(
  spreadsheetId: string,
  requests: any[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

// ─── Helper: Activity Log ─────────────────────────────────────────────────────
const LOG_SHEET = "activity_log";
const LOG_HEADERS = ["timestamp", "email", "action", "module", "detail", "rowIndex"];

export async function saLog(
  spreadsheetId: string,
  entry: { email: string; action: string; module: string; detail?: string; rowIndex?: number }
): Promise<void> {
  try {
    const sheets = getSheetsClient();

    // Check if activity_log sheet exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const exists = (meta.data.sheets || []).some((s) => s.properties?.title === LOG_SHEET);

    if (!exists) {
      // Create sheet + write headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: LOG_SHEET } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${LOG_SHEET}!A1:F1`,
        valueInputOption: "RAW",
        requestBody: { values: [LOG_HEADERS] },
      });
    }

    const row = [
      new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
      entry.email,
      entry.action,
      entry.module,
      entry.detail || "",
      entry.rowIndex != null ? entry.rowIndex : "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${LOG_SHEET}!A:F`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (err: any) {
    // Log ไม่ควร block main action
    console.warn(`⚠️ saLog failed: ${err.message}`);
  }
}

// ─── Helper: Write single range (PUT) ────────────────────────────────────────
export async function saWriteRange(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
