/**
 * Receipt Generate PDF API
 * POST /api/receipt/generate
 * 
 * สร้าง PDF ใบเสร็จจากข้อมูล transaction
 * รองรับการบันทึกไปยัง Google Drive (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import PDFDocument from "pdfkit";

interface ReceiptData {
  // Company Info
  companyName?: string;
  companyAddress?: string;
  companyTel?: string;
  companyTaxId?: string;

  // Receipt Info
  receiptNo: string;
  date: string;

  // Customer Info
  customerName?: string;
  customerAddress?: string;
  customerTel?: string;

  // Items
  items: Array<{
    description: string;
    quantity?: number;
    price?: number;
    amount: number;
  }>;

  // Payment
  subtotal: number;
  discount?: number;
  vat?: number;
  total: number;
  paymentMethod?: string;

  // Additional fields
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    console.log("=".repeat(60));
    console.log(`📄 [${requestId}] RECEIPT GENERATE PDF API`);
    console.log("=".repeat(60));

    // ✅ AUTH
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token || !(token as any)?.accessToken) {
      console.error(`❌ [${requestId}] Unauthorized`);
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const accessToken = (token as any).accessToken as string;

    // ✅ GET REQUEST BODY
    const body = await request.json();
    const receiptData: ReceiptData = body.receiptData;
    const saveToGoogleDrive = body.saveToGoogleDrive || false;
    const driveFolderId = body.driveFolderId || null;

    if (!receiptData) {
      console.error(`❌ [${requestId}] Missing receiptData`);
      return NextResponse.json(
        { error: "Missing receiptData", code: "MISSING_DATA" },
        { status: 400 }
      );
    }

    console.log(`📌 [${requestId}] Receipt No: ${receiptData.receiptNo}`);
    console.log(`📌 [${requestId}] Date: ${receiptData.date}`);
    console.log(`📌 [${requestId}] Total: ${receiptData.total}`);
    console.log(`📌 [${requestId}] Save to Drive: ${saveToGoogleDrive}`);

    // ✅ CREATE PDF
    console.log(`⏳ [${requestId}] Creating PDF...`);

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      console.log(`✅ [${requestId}] PDF created successfully`);
    });

    // ✅ LOAD THAI FONT (Sarabun)
    const fontPath = "/usr/share/fonts/truetype/thai/Sarabun-Regular.ttf";
    const fontBoldPath = "/usr/share/fonts/truetype/thai/Sarabun-Bold.ttf";

    try {
      doc.registerFont("Sarabun", fontPath);
      doc.registerFont("Sarabun-Bold", fontBoldPath);
      doc.font("Sarabun");
    } catch (error) {
      console.warn(`⚠️ [${requestId}] Thai font not found, using default font`);
    }

    // ===================================
    // PDF LAYOUT
    // ===================================

    const pageWidth = doc.page.width;
    const margin = 50;
    let yPosition = 50;

    // --- HEADER: Company Info ---
    doc.fontSize(18).font("Sarabun-Bold").text(
      receiptData.companyName || "บริษัท ทดสอบ จำกัด",
      margin,
      yPosition,
      { align: "center" }
    );
    yPosition += 25;

    doc.fontSize(10).font("Sarabun").text(
      receiptData.companyAddress || "ที่อยู่บริษัท",
      margin,
      yPosition,
      { align: "center" }
    );
    yPosition += 15;

    doc.text(
      `โทร: ${receiptData.companyTel || "-"} | เลขประจำตัวผู้เสียภาษี: ${receiptData.companyTaxId || "-"}`,
      margin,
      yPosition,
      { align: "center" }
    );
    yPosition += 30;

    // --- TITLE ---
    doc.fontSize(16).font("Sarabun-Bold").text(
      "ใบเสร็จรับเงิน / Receipt",
      margin,
      yPosition,
      { align: "center" }
    );
    yPosition += 30;

    // --- Receipt Info ---
    doc.fontSize(10).font("Sarabun");
    doc.text(`เลขที่ / No.: ${receiptData.receiptNo}`, margin, yPosition);
    doc.text(`วันที่ / Date: ${receiptData.date}`, pageWidth - margin - 150, yPosition, {
      width: 150,
      align: "right",
    });
    yPosition += 25;

    // --- Customer Info ---
    if (receiptData.customerName) {
      doc.text(`ลูกค้า / Customer: ${receiptData.customerName}`, margin, yPosition);
      yPosition += 15;
    }

    if (receiptData.customerAddress) {
      doc.text(`ที่อยู่ / Address: ${receiptData.customerAddress}`, margin, yPosition);
      yPosition += 15;
    }

    if (receiptData.customerTel) {
      doc.text(`โทร / Tel: ${receiptData.customerTel}`, margin, yPosition);
      yPosition += 20;
    } else {
      yPosition += 10;
    }

    // --- LINE ---
    doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).stroke();
    yPosition += 15;

    // --- TABLE HEADER ---
    doc.fontSize(10).font("Sarabun-Bold");
    const colDescription = margin;
    const colQty = pageWidth - margin - 250;
    const colPrice = pageWidth - margin - 150;
    const colAmount = pageWidth - margin - 80;

    doc.text("รายการ / Description", colDescription, yPosition);
    doc.text("จำนวน", colQty, yPosition, { width: 50, align: "right" });
    doc.text("ราคา", colPrice, yPosition, { width: 70, align: "right" });
    doc.text("จำนวนเงิน", colAmount, yPosition, { width: 80, align: "right" });
    yPosition += 20;

    doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).stroke();
    yPosition += 10;

    // --- ITEMS ---
    doc.font("Sarabun");
    (receiptData.items || []).forEach((item) => {
      doc.text(item.description, colDescription, yPosition, { width: 250 });

      if (item.quantity) {
        doc.text(item.quantity.toString(), colQty, yPosition, { width: 50, align: "right" });
      }

      if (item.price) {
        doc.text(item.price.toFixed(2), colPrice, yPosition, { width: 70, align: "right" });
      }

      doc.text(item.amount.toFixed(2), colAmount, yPosition, { width: 80, align: "right" });

      yPosition += 20;
    });

    yPosition += 5;
    doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).stroke();
    yPosition += 15;

    // --- SUMMARY ---
    doc.font("Sarabun");
    const summaryX = pageWidth - margin - 200;

    doc.text("รวม / Subtotal:", summaryX, yPosition);
    doc.text(receiptData.subtotal.toFixed(2), summaryX + 120, yPosition, {
      width: 80,
      align: "right",
    });
    yPosition += 15;

    if (receiptData.discount) {
      doc.text("ส่วนลด / Discount:", summaryX, yPosition);
      doc.text(`-${receiptData.discount.toFixed(2)}`, summaryX + 120, yPosition, {
        width: 80,
        align: "right",
      });
      yPosition += 15;
    }

    if (receiptData.vat) {
      doc.text("ภาษี VAT 7%:", summaryX, yPosition);
      doc.text(receiptData.vat.toFixed(2), summaryX + 120, yPosition, {
        width: 80,
        align: "right",
      });
      yPosition += 15;
    }

    doc.fontSize(12).font("Sarabun-Bold");
    doc.text("ยอดรวมสุทธิ / Total:", summaryX, yPosition);
    doc.text(receiptData.total.toFixed(2), summaryX + 120, yPosition, {
      width: 80,
      align: "right",
    });
    yPosition += 25;

    // --- Payment Method ---
    if (receiptData.paymentMethod) {
      doc.fontSize(10).font("Sarabun");
      doc.text(`วิธีการชำระเงิน: ${receiptData.paymentMethod}`, margin, yPosition);
      yPosition += 30;
    }

    // --- FOOTER ---
    doc.fontSize(9).font("Sarabun").text(
      "ขอบคุณที่ใช้บริการ / Thank you",
      margin,
      yPosition,
      { align: "center" }
    );

    // Finalize PDF
    doc.end();

    // Wait for PDF to finish
    const pdfBuffer = await new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    console.log(`✅ [${requestId}] PDF size: ${pdfBuffer.length} bytes`);

    // ✅ SAVE TO GOOGLE DRIVE (Optional)
    if (saveToGoogleDrive && driveFolderId) {
      console.log(`⏳ [${requestId}] Saving to Google Drive...`);

      const fileName = `Receipt_${receiptData.receiptNo}_${Date.now()}.pdf`;
      const metadata = {
        name: fileName,
        mimeType: "application/pdf",
        parents: [driveFolderId],
      };

      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      // ✅ แก้เป็น
      form.append("file", new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }));

      const driveResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: form,
        }
      );

      if (driveResponse.ok) {
        const driveData = await driveResponse.json();
        console.log(`✅ [${requestId}] Saved to Drive: ${driveData.id}`);

        return NextResponse.json({
          success: true,
          message: "PDF generated and saved to Google Drive",
          driveFileId: driveData.id,
          driveFileUrl: `https://drive.google.com/file/d/${driveData.id}/view`,
        });
      } else {
        console.warn(`⚠️ [${requestId}] Failed to save to Drive`);
      }
    }

    // ✅ RETURN PDF
    console.log("=".repeat(60));
    console.log(`✅ [${requestId}] SUCCESS - Returning PDF`);
    console.log("=".repeat(60));

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Receipt_${receiptData.receiptNo}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error("=".repeat(60));
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(error.stack);
    console.error("=".repeat(60));

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        message: error.message,
      },
      { status: 500 }
    );
  }
}