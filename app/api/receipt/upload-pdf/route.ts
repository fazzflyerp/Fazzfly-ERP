/**
 * Upload Receipt PDF to Google Drive
 * ✅ ใช้ token ของ Admin บริษัทนั้น — ไฟล์ขึ้น Drive ของ Admin เสมอ
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saReadRange, saLog } from "@/lib/google-sa";
import { adminFindOrCreateFolder, adminDriveUpload } from "@/lib/admin-drive";

const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID!;

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const userEmail = ((token as any)?.email as string || "").toLowerCase();

    // หา clientId จาก client_user
    const userRows = await saReadRange(MASTER_SHEET_ID, "client_user!A:E");
    const userRow = userRows.slice(1).find(
      (r) => (r[1] ?? "").toString().toLowerCase().trim() === userEmail
    );
    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const clientId = (userRow[0] ?? "").toString().trim();

    const formData = await request.formData();
    const pdfFile      = formData.get("file") as File;
    const receiptNo    = formData.get("receiptNo") as string;
    const customerId   = formData.get("customerId") as string;
    const date         = formData.get("date") as string; // DD/MM/YYYY
    const rootFolderId = formData.get("rootFolderId") as string;
    const spreadsheetId = formData.get("spreadsheetId") as string | null;

    if (!pdfFile || !receiptNo || !customerId || !date || !rootFolderId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    console.log(`📄 [${requestId}] Receipt: ${receiptNo}, Client: ${clientId}`);

    // Parse date DD/MM/YYYY → folder structure YYYY/MMM/DD
    const [day, month, year] = date.split("/");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthName = monthNames[parseInt(month) - 1];

    const yearFolderId  = await adminFindOrCreateFolder(clientId, year, rootFolderId);
    const monthFolderId = await adminFindOrCreateFolder(clientId, monthName, yearFolderId);
    const dayFolderId   = await adminFindOrCreateFolder(clientId, day, monthFolderId);

    const fileName = `${receiptNo}_${customerId}.pdf`;
    const buffer   = Buffer.from(await pdfFile.arrayBuffer());

    const { fileId, webViewLink } = await adminDriveUpload({
      clientId,
      fileName,
      mimeType: "application/pdf",
      buffer,
      parentFolderId: dayFolderId,
    });

    console.log(`✅ [${requestId}] Uploaded: ${fileId}`);

    if (spreadsheetId) {
      saLog(spreadsheetId, {
        email:  userEmail,
        action: "upload_pdf",
        module: "receipt",
        detail: `${receiptNo} — ${customerId}`,
      });
    }

    return NextResponse.json({ success: true, fileId, fileName, webViewLink, folderPath: `${year}/${monthName}/${day}/` });

  } catch (error: any) {
    console.error(`❌ [${requestId}] receipt/upload-pdf:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
