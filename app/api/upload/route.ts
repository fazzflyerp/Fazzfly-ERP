/**
 * Upload Image to Google Drive API
 * POST /api/upload
 *
 * ✅ ใช้ Admin Drive token (จาก client_master) — Staff อัปโหลดได้ทุกคน
 * ✅ Rate limiting
 * ✅ File validation (type + size)
 * ✅ Retry mechanism ใน adminDriveUpload
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { withLogger } from "@/lib/with-logger";
import { saReadRange } from "@/lib/google-sa";
import { getAdminAccessToken, adminFindOrCreateFolder } from "@/lib/admin-drive";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES   = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_UPLOADS_PER_HOUR = 50;

// ── Rate limiting ─────────────────────────────────────────────────────────────
const uploadLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userEmail: string): boolean {
  const now = Date.now();
  const cur = uploadLimits.get(userEmail);
  if (!cur || now > cur.resetAt) {
    uploadLimits.set(userEmail, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (cur.count < MAX_UPLOADS_PER_HOUR) { cur.count++; return true; }
  return false;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
}

async function _POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log(`📤 [${requestId}] IMAGE UPLOAD API`);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !(token as any)?.email)
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    // ── Rate limit ────────────────────────────────────────────────────────────
    if (!checkRateLimit(userEmail)) {
      return NextResponse.json(
        { error: "Too many uploads", code: "RATE_LIMIT_EXCEEDED", message: `Max ${MAX_UPLOADS_PER_HOUR}/hr` },
        { status: 429 }
      );
    }

    // ── หา clientId จาก master sheet ─────────────────────────────────────────
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow  = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    // ── ใช้ Admin access token แทน user personal token ─────────────────────
    const adminToken = await getAdminAccessToken(clientId);
    console.log(`🔑 [${requestId}] Using admin token for client: ${clientId}`);

    // ── Validate file ─────────────────────────────────────────────────────────
    const formData = await request.formData();
    const file     = formData.get("file") as File;

    if (!file)
      return NextResponse.json({ error: "No file provided", code: "NO_FILE" }, { status: 400 });

    console.log(`📎 [${requestId}] File:`, file.name, file.type, file.size);

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: "Invalid file type", code: "INVALID_TYPE" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: "File too large (max 5MB)", code: "FILE_TOO_LARGE" }, { status: 400 });
    if (file.size < 100)
      return NextResponse.json({ error: "File too small", code: "FILE_TOO_SMALL" }, { status: 400 });

    // ── Prepare buffer + filename ─────────────────────────────────────────────
    const buffer    = Buffer.from(await file.arrayBuffer());
    const finalName = `${Date.now()}_${sanitizeFilename(file.name)}`;

    // ── Resolve upload folder ─────────────────────────────────────────────────
    const rootFolderId =
      (formData.get("folderId") as string | null) ||
      process.env.UPLOAD_ROOT_FOLDER_ID ||
      null;

    let parentFolderId: string | undefined;
    if (rootFolderId) {
      try {
        const now  = new Date();
        const year  = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const day   = now.getDate().toString().padStart(2, "0");

        const yearId  = await adminFindOrCreateFolder(clientId, year,  rootFolderId);
        const monthId = await adminFindOrCreateFolder(clientId, month, yearId);
        const dayId   = await adminFindOrCreateFolder(clientId, day,   monthId);
        parentFolderId = dayId;
        console.log(`📁 [${requestId}] Target folder: ${parentFolderId}`);
      } catch (err: any) {
        console.warn(`⚠️ [${requestId}] Folder resolve failed, uploading to Drive root: ${err.message}`);
      }
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    console.log(`⏳ [${requestId}] Uploading to Drive...`);

    const uploadForm = new FormData();
    uploadForm.append("metadata", new Blob([JSON.stringify({
      name:        finalName,
      mimeType:    file.type,
      description: `Uploaded by ${userEmail}`,
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    })], { type: "application/json" }));
    uploadForm.append("file", new Blob([buffer], { type: file.type }));

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: uploadForm }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`❌ [${requestId}] Drive upload error:`, errText);
      throw new Error(`Drive upload failed: ${uploadRes.status}`);
    }

    const { id: fileId, webViewLink } = await uploadRes.json();
    console.log(`✅ [${requestId}] Uploaded: ${fileId}`);

    // ── Set public read permission ─────────────────────────────────────────────
    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ role: "reader", type: "anyone" }),
      }
    );
    if (!permRes.ok) {
      console.warn(`⚠️ [${requestId}] Could not set public permission`);
    } else {
      console.log(`✅ [${requestId}] File shared publicly`);
    }

    const fileUrl      = webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    const directUrl    = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return NextResponse.json({
      success: true, fileId, fileUrl, thumbnailUrl, directUrl,
      fileName: finalName, originalName: file.name, mimeType: file.type,
      size: file.size, uploadedBy: userEmail, uploadedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Upload Error:`, error.message);
    return NextResponse.json(
      { error: "Upload failed", code: "UPLOAD_ERROR", message: error.message },
      { status: 500 }
    );
  }
}

export const POST = withLogger("/api/upload", _POST);
