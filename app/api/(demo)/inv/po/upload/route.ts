/**
 * POST /api/inv/po/upload
 *
 * อัปโหลดใบ PO ที่หัวหน้าเซ็นแล้ว ขึ้น Google Drive
 * - รองรับ PDF + รูปภาพ
 * - ขนาดไม่เกิน 20MB
 * - ตั้งชื่อไฟล์ตาม PO ID
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange } from "@/lib/google-sa";
import { getAdminAccessToken, adminFindOrCreateFolder } from "@/lib/admin-drive";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;
const MAX_FILE_SIZE   = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES   = [
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp",
];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !(token as any)?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    // ── หา clientId ──────────────────────────────────────────────────────────
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow  = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    // ── Admin token ───────────────────────────────────────────────────────────
    const adminToken = await getAdminAccessToken(clientId);

    // ── Validate file ─────────────────────────────────────────────────────────
    const formData = await request.formData();
    const file     = formData.get("file") as File;
    const poId     = (formData.get("po_id") as string | null) || "";

    if (!file)
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: "ไฟล์ต้องเป็น PDF หรือรูปภาพเท่านั้น" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: "ขนาดไฟล์เกิน 20MB" }, { status: 400 });

    // ── Prepare ───────────────────────────────────────────────────────────────
    const buffer    = Buffer.from(await file.arrayBuffer());
    const ext       = file.name.split(".").pop() || "pdf";
    const finalName = poId
      ? `PO_${poId}_signed.${ext}`
      : `PO_signed_${Date.now()}_${sanitizeFilename(file.name)}`;

    // ── Folder: UPLOAD_ROOT_FOLDER_ID / PO_Signed / ──────────────────────────
    let parentFolderId: string | undefined;
    const rootFolderId = process.env.UPLOAD_ROOT_FOLDER_ID;
    if (rootFolderId) {
      try {
        parentFolderId = await adminFindOrCreateFolder(clientId, "PO_Signed", rootFolderId);
      } catch {
        // fallback to Drive root
      }
    }

    // ── Upload to Drive ───────────────────────────────────────────────────────
    const uploadForm = new FormData();
    uploadForm.append("metadata", new Blob([JSON.stringify({
      name:     finalName,
      mimeType: file.type,
      description: `Signed PO document — ${poId} — uploaded by ${userEmail}`,
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    })], { type: "application/json" }));
    uploadForm.append("file", new Blob([buffer], { type: file.type }));

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: uploadForm }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Drive upload failed: ${uploadRes.status} — ${errText}`);
    }

    const { id: fileId, webViewLink } = await uploadRes.json();

    // ── Set public readable ────────────────────────────────────────────────────
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method:  "POST",
        headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ role: "reader", type: "anyone" }),
      }
    );

    const fileUrl = webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return NextResponse.json({
      ok: true, fileId, fileUrl, fileName: finalName,
      originalName: file.name, mimeType: file.type, size: file.size,
    });

  } catch (err: any) {
    console.error("PO upload error:", err.message);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
