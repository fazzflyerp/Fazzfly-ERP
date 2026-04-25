/**
 * GET  /api/crm/photos?clientId=&action=root&customerId=&customerName=
 *      → หา/สร้าง customer root folder, return folderId
 *
 * GET  /api/crm/photos?clientId=&action=list&folderId=
 *      → list subfolders + image files ใน folder นั้น
 *
 * POST /api/crm/photos  (multipart/form-data)
 *      fields: clientId, customerId, customerName, date (YYYY-MM-DD), label, file
 *      → upload ไฟล์ลง Drive ตาม path CRM_Photos/{cust}/{YYYY}/{MM}/{DD}/
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { adminFindOrCreateFolder, adminDriveUpload, getAdminAccessToken } from "@/lib/admin-drive";

// ── helpers ──────────────────────────────────────────────────────────────────
const CRM_ROOT_NAME = "CRM_Photos";

async function ensurePath(
  clientId: string,
  customerId: string,
  customerName: string,
  date: string // YYYY-MM-DD
): Promise<string> {
  const [yyyy, mm, dd] = date.split("-");

  // 1. CRM_Photos (in My Drive root)
  const crmRoot = await adminFindOrCreateFolder(clientId, CRM_ROOT_NAME, "root");

  // 2. {customerId}_{customerName}
  const safeName = `${customerId}_${customerName.replace(/[/\\?%*:|"<>]/g, "_")}`;
  const custFolder = await adminFindOrCreateFolder(clientId, safeName, crmRoot);

  // 3. YYYY → MM → DD
  const yearFolder  = await adminFindOrCreateFolder(clientId, yyyy, custFolder);
  const monthFolder = await adminFindOrCreateFolder(clientId, mm,   yearFolder);
  const dayFolder   = await adminFindOrCreateFolder(clientId, dd,   monthFolder);

  return dayFolder;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp           = request.nextUrl.searchParams;
  const clientId     = sp.get("clientId")     || "";
  const action       = sp.get("action")       || "list";
  const folderId     = sp.get("folderId")     || "";
  const customerId   = sp.get("customerId")   || "";
  const customerName = sp.get("customerName") || "";

  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  try {
    // ── action=root : หา/สร้าง CRM_Photos/{cust} folder ────────────────────
    if (action === "root") {
      if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
      const crmRoot  = await adminFindOrCreateFolder(clientId, CRM_ROOT_NAME, "root");
      const safeName = `${customerId}_${customerName.replace(/[/\\?%*:|"<>]/g, "_")}`;
      const custId   = await adminFindOrCreateFolder(clientId, safeName, crmRoot);
      return NextResponse.json({ success: true, folderId: custId });
    }

    // ── action=list : list folders + image files ─────────────────────────────
    if (action === "list") {
      if (!folderId) return NextResponse.json({ error: "Missing folderId" }, { status: 400 });

      const accessToken = await getAdminAccessToken(clientId);

      const q = `'${folderId}' in parents and trashed=false`;
      const fields = "files(id,name,mimeType,thumbnailLink,webViewLink,createdTime,size)";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=200`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Drive list failed: ${err}`);
      }

      const data  = await res.json();
      const files: any[] = data.files || [];

      const folders = files.filter(f => f.mimeType === "application/vnd.google-apps.folder")
        .map(f => ({ id: f.id, name: f.name }));

      const images = files.filter(f => f.mimeType?.startsWith("image/"))
        .map(f => ({
          id:            f.id,
          name:          f.name,
          mimeType:      f.mimeType,
          thumbnailLink: f.thumbnailLink || null,
          webViewLink:   f.webViewLink   || null,
          createdTime:   f.createdTime   || null,
          size:          f.size          || null,
        }));

      return NextResponse.json({ success: true, folders, images });
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });

  } catch (err: any) {
    console.error("❌ crm/photos GET:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form         = await request.formData();
    const clientId     = (form.get("clientId")     as string) || "";
    const customerId   = (form.get("customerId")   as string) || "";
    const customerName = (form.get("customerName") as string) || "";
    const date         = (form.get("date")         as string) || new Date().toISOString().slice(0, 10);
    const label        = (form.get("label")        as string) || "photo";
    const file         = form.get("file") as File | null;

    if (!clientId)   return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
    if (!customerId) return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
    if (!file)       return NextResponse.json({ error: "Missing file" }, { status: 400 });

    // build folder path
    const dayFolderId = await ensurePath(clientId, customerId, customerName, date);

    // prepare file
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const ext         = file.name.split(".").pop() || "jpg";
    const ts          = Date.now();
    const fileName    = `${ts}_${label}.${ext}`;

    const result = await adminDriveUpload({
      clientId,
      fileName,
      mimeType:       file.type || "image/jpeg",
      buffer,
      parentFolderId: dayFolderId,
    });

    return NextResponse.json({ success: true, fileId: result.fileId, webViewLink: result.webViewLink, fileName });

  } catch (err: any) {
    console.error("❌ crm/photos POST:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
