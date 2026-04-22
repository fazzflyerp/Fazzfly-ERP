/**
 * =============================================================================
 * FILE PATH: app/api/receipt/upload-pdf/route.ts
 * =============================================================================
 *
 * Upload Receipt PDF to Google Drive via SA
 * ✅ ใช้ SA — ทั้ง Admin และ Staff สามารถ save ได้
 * ✅ ไฟล์ขึ้น Drive ของ Admin (SA มีสิทธิ์อยู่แล้ว)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { saFindOrCreateFolder, saUploadFile, saLog } from "@/lib/google-sa";

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((token as any).error === "RefreshAccessTokenError")
      return NextResponse.json({ error: "Session expired", code: "TOKEN_EXPIRED" }, { status: 401 });

    const formData = await request.formData();
    const pdfFile = formData.get("file") as File;
    const receiptNo = formData.get("receiptNo") as string;
    const customerId = formData.get("customerId") as string;
    const date = formData.get("date") as string; // Format: "DD/MM/YYYY"
    const rootFolderId = formData.get("rootFolderId") as string;
    const spreadsheetId = formData.get("spreadsheetId") as string | null;

    if (!pdfFile || !receiptNo || !customerId || !date || !rootFolderId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    console.log(`📄 [${requestId}] Receipt: ${receiptNo}, Customer: ${customerId}, Date: ${date}`);

    // Parse date DD/MM/YYYY
    const [day, month, year] = date.split("/");
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthName = monthNames[parseInt(month) - 1];

    // Create folder structure: YYYY/MMM/DD/
    const yearFolderId  = await saFindOrCreateFolder(year, rootFolderId);
    const monthFolderId = await saFindOrCreateFolder(monthName, yearFolderId);
    const dayFolderId   = await saFindOrCreateFolder(day, monthFolderId);

    // Upload PDF
    const fileName = `${receiptNo}_${customerId}.pdf`;
    const buffer = Buffer.from(await pdfFile.arrayBuffer());

    const { fileId, webViewLink } = await saUploadFile({
      fileName,
      mimeType: "application/pdf",
      buffer,
      parentFolderId: dayFolderId,
    });

    console.log(`✅ [${requestId}] Uploaded: ${fileId}`);

    const userEmail = ((token as any)?.email as string || "").toLowerCase();
    if (spreadsheetId) {
      saLog(spreadsheetId, {
        email: userEmail,
        action: "upload_pdf",
        module: "receipt",
        detail: `${receiptNo} — ${customerId}`,
      });
    }

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      webViewLink,
      folderPath: `${year}/${monthName}/${day}/`,
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return NextResponse.json({ error: "Failed to upload PDF", details: error.message }, { status: 500 });
  }
}
