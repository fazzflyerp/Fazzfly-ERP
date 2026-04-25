/**
 * lib/admin-drive.ts
 *
 * Upload ไฟล์ขึ้น Google Drive ของ Admin แต่ละบริษัท
 * — อ่าน refresh token จาก client_master col I ตาม clientId
 * — Cache access token per clientId (1 ชั่วโมง)
 * — Scale ได้ไม่จำกัด client — ไม่ต้องแตะ env
 */

import { saReadRange, saWriteRange } from "@/lib/google-sa";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET!;

// ── Cache access token per clientId ──────────────────────────────────────────
interface TokenCache { accessToken: string; expiresAt: number }
const _tokenCache = new Map<string, TokenCache>();

// ── Cache refresh token per clientId (10 min) ─────────────────────────────────
interface RefreshCache { refreshToken: string; expiry: number }
const _refreshCache = new Map<string, RefreshCache>();

async function getRefreshToken(clientId: string): Promise<string> {
  const now = Date.now();
  const cached = _refreshCache.get(clientId);
  if (cached && now < cached.expiry) return cached.refreshToken;

  // อ่าน client_master!A:I
  const rows = await saReadRange(MASTER_SHEET_ID, "client_master!A:I");
  if (rows.length === 0) throw new Error("client_master sheet is empty");

  const headers   = rows[0];
  const clientCol = headers.findIndex((h: string) => h.toLowerCase() === "client_id");
  const tokenCol  = headers.findIndex((h: string) => h.toLowerCase() === "admin_refresh_token");

  if (tokenCol === -1) {
    throw new Error("ยังไม่มี column admin_refresh_token ใน client_master — Admin ต้อง login เพื่อ sync token");
  }

  const row = rows.slice(1).find(
    (r) => (r[clientCol] ?? "").toString().trim() === clientId &&
            (r[tokenCol]  ?? "").toString().trim() !== ""
  );

  if (!row) {
    throw new Error(`ไม่พบ refresh token สำหรับ client ${clientId} — Admin กรุณา login ใหม่`);
  }

  const refreshToken = row[tokenCol].toString().trim();
  _refreshCache.set(clientId, { refreshToken, expiry: now + 10 * 60 * 1000 });
  return refreshToken;
}

export async function getAdminAccessToken(clientId: string): Promise<string> {
  const now = Date.now();
  const cached = _tokenCache.get(clientId);
  if (cached && now < cached.expiresAt - 120_000) return cached.accessToken;

  const refreshToken = await getRefreshToken(clientId);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    _refreshCache.delete(clientId);
    throw new Error(`Failed to refresh admin token for ${clientId}: ${err}`);
  }

  const data = await res.json();
  _tokenCache.set(clientId, {
    accessToken: data.access_token,
    expiresAt:   now + (data.expires_in || 3600) * 1000,
  });
  return data.access_token;
}

/**
 * Upload ไฟล์ขึ้น Google Drive ของ Admin บริษัทนั้น
 */
export async function adminDriveUpload(params: {
  clientId:       string;
  fileName:       string;
  mimeType:       string;
  buffer:         Buffer;
  parentFolderId: string;
}): Promise<{ fileId: string; webViewLink: string }> {
  const accessToken = await getAdminAccessToken(params.clientId);

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify({
    name:    params.fileName,
    parents: [params.parentFolderId],
  })], { type: "application/json" }));
  form.append("file", new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }));

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }

  const data = await res.json();
  return { fileId: data.id, webViewLink: data.webViewLink };
}

/**
 * หา/สร้าง folder ใน Drive ของ Admin บริษัทนั้น
 */
export async function adminFindOrCreateFolder(
  clientId:   string,
  folderName: string,
  parentId:   string
): Promise<string> {
  const accessToken = await getAdminAccessToken(clientId);

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (searchRes.ok) {
    const d = await searchRes.json();
    if (d.files?.[0]?.id) return d.files[0].id;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name:     folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents:  [parentId],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create folder: ${err}`);
  }

  return (await createRes.json()).id;
}

/**
 * Invalidate cache เมื่อ Admin login ใหม่
 */
export function invalidateAdminDriveCache(clientId: string) {
  _tokenCache.delete(clientId);
  _refreshCache.delete(clientId);
}
