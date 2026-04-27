/**
 * =============================================================================
 * FILE PATH: app/api/receipt/generate-pdf-html/route.ts
 * =============================================================================
 * 
 * Generate PDF from HTML (เหมือน ReceiptPreview เป๊ะๆ + Auto scale)
 */

import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-browser";
import { getEmbeddedFontStyle } from "@/lib/pdf-fonts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      hasVAT = true, // ✅ รับ flag (default = true เพื่อ backward compatibility)
      companyInfo,
      receiptNo,
      date,
      customerId,
      customerName,
      customerTel,
      customerAddress,
      items,
      subtotal_before_vat,
      total_vat,
      total_after_vat,
      paymentMethods,
    } = body;

    // คำนวณขนาดตัวอักษรตามจำนวนรายการ (เยอะ = ย่อ)
    const itemCount = items.length;
    const baseFontSize = itemCount > 12 ? 10 :
      itemCount > 8 ? 11 :
        itemCount > 5 ? 12 : 13;

    const sarabunCss = await getEmbeddedFontStyle("Sarabun", ["400", "600", "700"]);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${sarabunCss}</style>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Sarabun', sans-serif; 
      color: #1e293b;
      font-size: ${baseFontSize}px;
      line-height: 1.3;
    }
    
    .container {
      width: 210mm;
      min-height: 297mm;
      padding: 12mm;
      background: white;
    }

    /* Header */
    .header { 
      text-align: center; 
      margin-bottom: ${itemCount > 8 ? '12px' : '16px'}; 
      padding-bottom: ${itemCount > 8 ? '12px' : '16px'}; 
      border-bottom: 2px solid #1e293b; 
    }

    .logo-container { margin-bottom: ${itemCount > 8 ? '8px' : '12px'}; }

    .logo { max-height: ${itemCount > 8 ? '50px' : '60px'}; max-width: 200px; }

    .logo-fallback {
      display: inline-block;
      padding: ${itemCount > 8 ? '8px 16px' : '10px 20px'};
      background: #f1f5f9;
      border-radius: 8px;
      font-size: ${itemCount > 8 ? '28px' : '32px'};
      font-weight: 700;
      color: #94a3b8;
    }

    .company-name { 
      font-size: ${baseFontSize + 7}px; 
      font-weight: 700; 
      color: #1e293b; 
      margin-bottom: 4px; 
    }

    .company-name-en { 
      font-size: ${baseFontSize - 1}px; 
      color: #64748b; 
      margin-bottom: 6px; 
    }

    .company-info { 
      font-size: ${baseFontSize - 2}px; 
      color: #64748b; 
      line-height: 1.5;
    }

    /* Title */
    .title-section { 
      text-align: center; 
      margin-bottom: ${itemCount > 8 ? '12px' : '16px'}; 
    }

    .title {
      font-size: ${baseFontSize + 5}px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .title-line {
      width: 100px;
      height: 2px;
      background: linear-gradient(to right, transparent, #1e293b, transparent);
      margin: 0 auto;
    }

    /* Receipt Info */
    .receipt-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: ${itemCount > 8 ? '10px' : '14px'};
      font-size: ${baseFontSize - 1}px;
    }

    .info-label { color: #64748b; margin-bottom: 2px; }
    .info-value { font-weight: 700; color: #1e293b; }

    /* Customer Box */
    .customer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: ${itemCount > 8 ? '10px' : '12px'};
      margin-bottom: ${itemCount > 8 ? '10px' : '14px'};
    }

    .customer-title {
      font-size: ${baseFontSize - 3}px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 8px;
      letter-spacing: 0.3px;
    }

    .customer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: ${baseFontSize - 1}px;
    }

    .customer-label { color: #64748b; display: block; }
    .customer-value { font-weight: 600; color: #1e293b; }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: ${itemCount > 8 ? '10px' : '14px'};
      font-size: ${baseFontSize - 1}px;
    }

    th {
      color: #1e293b;
      font-weight: 700;
      text-align: left;
      padding: ${itemCount > 8 ? '6px 4px' : '8px 4px'};
      border-bottom: 2px solid #1e293b;
      font-size: ${baseFontSize - 1}px;
      line-height: 1.2;
    }

    td {
      padding: ${itemCount > 8 ? '5px 4px' : '6px 4px'};
      border-bottom: 1px solid #e2e8f0;
      color: #475569;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-semibold { font-weight: 600; color: #1e293b; }

    /* Summary */
    .summary-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${itemCount > 8 ? '10px' : '14px'};
    }

    .summary-box { width: 350px; }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: ${itemCount > 8 ? '4px 0' : '6px 0'};
      border-bottom: 1px solid #e2e8f0;
      font-size: ${baseFontSize - 1}px;
    }

    .summary-label { color: #64748b; }
    .summary-value { font-weight: 600; color: #1e293b; }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: ${itemCount > 8 ? '8px 0' : '10px 0'};
      border-top: 2px solid #1e293b;
      margin-top: 4px;
    }

    .total-label { font-weight: 700; color: #1e293b; }
    .total-value { font-weight: 700; color: #1e293b; font-size: ${baseFontSize + 3}px; }

    /* Payment */
    .payment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: ${itemCount > 8 ? '10px' : '12px'};
      margin-bottom: ${itemCount > 8 ? '12px' : '16px'};
    }

    .payment-title {
      font-size: ${baseFontSize - 3}px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
    }

    .payment-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: ${baseFontSize - 1}px;
    }

    .payment-method { color: #475569; }
    .payment-amount { font-weight: 600; color: #1e293b; }

    /* Signature */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      padding-top: ${itemCount > 8 ? '12px' : '16px'};
      border-top: 1px solid #cbd5e1;
    }

    .signature-box { text-align: center; }

    .signature-space { height: ${itemCount > 8 ? '35px' : '45px'}; }

    .signature-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: ${baseFontSize - 2}px;
      color: #64748b;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: ${itemCount > 8 ? '12px' : '16px'};
      padding-top: ${itemCount > 8 ? '10px' : '14px'};
      border-top: 1px solid #cbd5e1;
      font-size: ${baseFontSize - 2}px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      ${companyInfo?.logo_url ? `
        <div class="logo-container">
          <img src="${companyInfo.logo_url}" alt="Logo" class="logo" />
        </div>
      ` : `
        <div class="logo-container">
          <div class="logo-fallback">${(companyInfo?.company_name || 'ABC').substring(0, 3)}</div>
        </div>
      `}
      
      <div class="company-name">${companyInfo?.company_name || 'บริษัท ทดสอบ จำกัด'}</div>
      ${companyInfo?.company_name_en ? `<div class="company-name-en">${companyInfo.company_name_en}</div>` : ''}
      <div class="company-info">${companyInfo?.address || '123 ถนนทดสอบ กรุงเทพฯ 10100'}<br>
      โทร: ${companyInfo?.tel || '02-123-4567'} | เลขประจำตัวผู้เสียภาษี: ${companyInfo?.tax_id || '0-0000-00000-00-0'}</div>
    </div>

    <!-- Title -->
    <div class="title-section">
      <div class="title">ใบเสร็จรับเงิน / RECEIPT</div>
      <div class="title-line"></div>
    </div>

    <!-- Receipt Info -->
    <div class="receipt-info">
      <div>
        <div class="info-label">เลขที่ / No.:</div>
        <div class="info-value">${receiptNo}</div>
      </div>
      <div style="text-align: right;">
        <div class="info-label">วันที่ / Date:</div>
        <div class="info-value">${date}</div>
      </div>
    </div>

    <!-- Customer Info -->
    <div class="customer-box">
      <div class="customer-title">ข้อมูลลูกค้า / Customer Information</div>
      <div class="customer-grid">
        <div>
          <span class="customer-label">รหัสลูกค้า / Customer ID:</span>
          <div class="customer-value">${customerId}</div>
        </div>
        <div>
          <span class="customer-label">ชื่อ / Name:</span>
          <div class="customer-value">${customerName}</div>
        </div>
        ${customerTel ? `
          <div>
            <span class="customer-label">เบอร์โทร / Tel:</span>
            <div class="customer-value">${customerTel}</div>
          </div>
        ` : ''}
        ${customerAddress ? `
          <div style="grid-column: span 2;">
            <span class="customer-label">ที่อยู่ / Address:</span>
            <div class="customer-value">${customerAddress}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">ลำดับ<br/>No.</th>
          <th>รายการ / Description</th>
          <th class="text-center" style="width: 60px;">จำนวน<br/>Qty</th>
          ${hasVAT ? `
            <th class="text-right" style="width: 85px;">ก่อนภาษี<br/>Before VAT</th>
            <th class="text-right" style="width: 60px;">ภาษี<br/>VAT</th>
            <th class="text-right" style="width: 95px;">หลังภาษี<br/>After VAT</th>
          ` : `
            <th class="text-right" style="width: 120px;">ยอดเงิน<br/>Amount</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any, index: number) => `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${item.description}</td>
            <td class="text-center">${item.quantity}</td>
            ${hasVAT ? `
              <td class="text-right">${item.amount_before_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">${item.vat_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td class="text-right font-semibold">${item.amount_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            ` : `
              <td class="text-right font-semibold">${item.amount_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            `}
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Summary -->
    <div class="summary-container">
      <div class="summary-box">
        ${hasVAT ? `
          <div class="summary-row">
            <span class="summary-label">ยอดรวมก่อนภาษี / Subtotal Before VAT:</span>
            <span class="summary-value">${subtotal_before_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">ภาษีมูลค่าเพิ่ม 7% / VAT 7%:</span>
            <span class="summary-value">${total_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
          <div class="total-row">
            <span class="total-label">ยอดรวมหลังภาษี / Grand Total:</span>
            <span class="total-value">${total_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        ` : `
          <div class="total-row">
            <span class="total-label">ยอดรวม / Grand Total:</span>
            <span class="total-value">${total_after_vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        `}
      </div>
    </div>

    <!-- Payment Methods -->
    ${paymentMethods && paymentMethods.length > 0 ? `
      <div class="payment-box">
        <div class="payment-title">วิธีการชำระเงิน / Payment Method</div>
        ${paymentMethods.map((p: any) => `
          <div class="payment-row">
            <span class="payment-method">${p.method}</span>
            <span class="payment-amount">${p.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Signature -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-space"></div>
        <div class="signature-line">ผู้รับเงิน / Receiver</div>
      </div>
      <div class="signature-box">
        <div class="signature-space"></div>
        <div class="signature-line">ผู้จ่ายเงิน / Payer</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      ขอบคุณที่ใช้บริการ / Thank you for your business
    </div>
  </div>
</body>
</html>
    `;

    // Generate PDF
    const pdfBuffer = await generatePdf(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Receipt_${receiptNo}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('PDF Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    );
  }
}