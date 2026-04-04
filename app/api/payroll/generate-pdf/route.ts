/**
 * =============================================================================
 * FILE PATH: app/api/payroll/generate-pdf/route.ts
 * =============================================================================
 *
 * Generate Payroll Slip PDF (Layout เหมือน PayrollSlipPreview เป๊ะๆ)
 */

import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-browser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      companyInfo,
      payPeriod,
      employeeId,
      employeeName,
      nickname,
      position,
      workingDays,
      leaveDays,
      lateMinutes,
      bankAccount,
      earnings = [],
      deductions = [],
      totalIncome,
      totalDeduction,
      netSalary,
    } = body;

    // Filter เฉพาะรายการที่มีจำนวนเงิน > 0
    const activeEarnings = earnings.filter((item: any) => item.amount > 0);
    const activeDeductions = deductions.filter((item: any) => item.amount > 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Noto Sans Thai', sans-serif;
      color: #000;
      background: white;
    }

    .container {
      width: 210mm;
      height: 297mm;
      background: white;
      display: flex;
      flex-direction: column;
    }

    /* Border Container */
    .border-container {
      height: 100%;
      border: 1px solid #d1d5db;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      border-bottom: 1px solid #d1d5db;
      background: #f9fafb;
      padding: 24px 32px;
      text-align: center;
    }

    .logo {
      max-height: 64px;
      max-width: 220px;
      margin-bottom: 12px;
    }

    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }

    .company-name-en {
      font-size: 14px;
      color: #4b5563;
      margin-bottom: 8px;
    }

    .company-info {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.5;
    }

    /* Title Bar */
    .title-bar {
      background: linear-gradient(to right, #475569, #1e293b);
      color: white;
      padding: 12px;
      text-align: center;
    }

    .title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* Content */
    .content {
      flex: 1;
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Employee Info Box */
    .employee-box {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .employee-box-header {
      background: #f1f5f9;
      padding: 8px 16px;
      border-bottom: 1px solid #d1d5db;
    }

    .employee-box-title {
      font-weight: 700;
      color: #334155;
      font-size: 14px;
    }

    .employee-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .employee-table td {
      padding: 10px 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .employee-table tr:last-child td {
      border-bottom: none;
    }

    .employee-label {
      width: 15%;
      font-weight: 600;
      color: #374151;
      background: #f8fafc;
    }

    .employee-value {
      width: 35%;
      color: #111827;
    }

    /* Tables Grid */
    .tables-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 20px;
    }

    /* Earnings/Deductions Table */
    .data-table-container {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      overflow: hidden;
    }

    .earnings-container {
      border-color: #93c5fd;
    }

    .deductions-container {
      border-color: #d1d5db;
    }

    .table-header {
      padding: 8px 16px;
      color: white;
      font-weight: 700;
      font-size: 14px;
    }

    .earnings-header {
      background: linear-gradient(to right, #2563eb, #1d4ed8);
    }

    .deductions-header {
      background: linear-gradient(to right, #475569, #334155);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .data-table thead {
      border-bottom: 1px solid #d1d5db;
    }

    .earnings-thead {
      background: #dbeafe;
      border-color: #93c5fd;
    }

    .deductions-thead {
      background: #f8fafc;
    }

    .data-table th {
      padding: 10px 16px;
      font-weight: 700;
      color: #1f2937;
      text-align: left;
    }

    .data-table td {
      padding: 8px 16px;
      border-bottom: 1px solid #e5e7eb;
      color: #1f2937;
    }

    .data-table tbody tr:hover {
      background: #f9fafb;
    }

    .text-right { text-align: right; }

    .amount-cell {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .earnings-amount { color: #1d4ed8; }
    .deductions-amount { color: #334155; }

    .total-row {
      background: #f1f5f9;
      border-top: 2px solid #cbd5e1;
    }

    .earnings-total-row { background: #dbeafe; border-top-color: #60a5fa; }
    .deductions-total-row { background: #f1f5f9; border-top-color: #94a3b8; }

    .total-row td {
      padding: 10px 16px;
      font-weight: 700;
      color: #111827;
      border-bottom: none;
    }

    .total-amount {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .earnings-total-amount { color: #1e40af; }
    .deductions-total-amount { color: #334155; }

    .empty-state {
      padding: 16px;
      text-align: center;
      color: #6b7280;
    }

    /* Net Salary Box */
    .net-salary-box {
      border: 1px solid #a5b4fc;
      border-radius: 8px;
      padding: 20px;
      background: linear-gradient(to right, #eef2ff, #e0e7ff);
      margin-bottom: 20px;
    }

    .net-salary-content {
      display: flex;
      justify-content: flex-end;
      align-items: baseline;
      gap: 12px;
    }

    .net-salary-label {
      font-size: 16px;
      color: #4b5563;
      font-weight: 600;
    }

    .net-salary-value {
      font-size: 32px;
      font-weight: 700;
      color: #4338ca;
      font-variant-numeric: tabular-nums;
    }

    /* Signature Section */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 64px;
      padding-top: 24px;
      border-top: 1px solid #d1d5db;
      margin-bottom: 16px;
    }

    .signature-box {
      text-align: center;
    }

    .signature-space {
      height: 64px;
      margin-bottom: 8px;
    }

    .signature-line {
      border-top: 1px solid #6b7280;
      padding-top: 8px;
    }

    .signature-title {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
    }

    .signature-date {
      font-size: 12px;
      color: #4b5563;
      margin-top: 4px;
    }

    /* Footer */
    .footer {
      padding-top: 12px;
      border-top: 1px solid #d1d5db;
      text-align: center;
    }

    .footer-text {
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="border-container">

      <!-- Header -->
      <div class="header">
        ${companyInfo?.logo_url ? `
          <img src="${companyInfo.logo_url}" alt="Company Logo" class="logo" />
        ` : ''}

        <div class="company-name">${companyInfo?.company_name || 'บริษัท ทดสอบ จำกัด'}</div>

        ${companyInfo?.company_name_en ? `
          <div class="company-name-en">${companyInfo.company_name_en}</div>
        ` : ''}

        <div class="company-info">
          <p>${companyInfo?.address || '123 ถนนทดสอบ กรุงเทพฯ 10100'}</p>
          <p>โทรศัพท์: ${companyInfo?.tel || '02-123-4567'} | เลขประจำตัวผู้เสียภาษี: ${companyInfo?.tax_id || '0-0000-00000-00-0'}</p>
        </div>
      </div>

      <!-- Title Bar -->
      <div class="title-bar">
        <div class="title">สลิปเงินเดือน / PAY SLIP</div>
      </div>

      <!-- Content -->
      <div class="content">
        <div>
          <!-- Employee Info -->
          <div class="employee-box">
            <div class="employee-box-header">
              <div class="employee-box-title">ข้อมูลพนักงาน / Employee Information</div>
            </div>
            <table class="employee-table">
              <tbody>
                <tr>
                  <td class="employee-label">รหัสพนักงาน:</td>
                  <td class="employee-value">${employeeId}</td>
                  <td class="employee-label">งวดเงินเดือน:</td>
                  <td class="employee-value">${payPeriod}</td>
                </tr>
                <tr>
                  <td class="employee-label">ชื่อ-สกุล:</td>
                  <td class="employee-value">${employeeName}${nickname ? ` (${nickname})` : ''}</td>
                  <td class="employee-label">ตำแหน่ง:</td>
                  <td class="employee-value">${position || '-'}</td>
                </tr>
                <tr>
                  <td class="employee-label">วันทำงาน:</td>
                  <td class="employee-value">${workingDays || 0} วัน</td>
                  <td class="employee-label">บัญชีธนาคาร:</td>
                  <td class="employee-value">${bankAccount || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tables Grid -->
          <div class="tables-grid">

            <!-- Earnings Table -->
            <div class="data-table-container earnings-container">
              <div class="table-header earnings-header">รายได้ / EARNINGS</div>
              <table class="data-table">
                <thead class="earnings-thead">
                  <tr>
                    <th>รายการ</th>
                    <th class="text-right" style="width: 130px;">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeEarnings.length > 0 ? activeEarnings.map((item: any) => `
                    <tr>
                      <td>${item.label}</td>
                      <td class="text-right amount-cell earnings-amount">
                        ${item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="2" class="empty-state">ไม่มีรายการ</td>
                    </tr>
                  `}
                  <tr class="total-row earnings-total-row">
                    <td>รวมรายได้</td>
                    <td class="text-right total-amount earnings-total-amount">
                      ${totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Deductions Table -->
            <div class="data-table-container deductions-container">
              <div class="table-header deductions-header">รายการหัก / DEDUCTIONS</div>
              <table class="data-table">
                <thead class="deductions-thead">
                  <tr>
                    <th>รายการ</th>
                    <th class="text-right" style="width: 130px;">จำนวนเงิน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeDeductions.length > 0 ? activeDeductions.map((item: any) => {
                    let label = item.label;
                    if (label.includes('วันลา') && leaveDays) label += ' (' + leaveDays + ' วัน)';
                    if (label.includes('มาสาย') && lateMinutes) label += ' (' + lateMinutes + ' นาที)';

                    return '<tr><td>' + label + '</td><td class="text-right amount-cell deductions-amount">' +
                      item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
                      '</td></tr>';
                  }).join('') : '<tr><td colspan="2" class="empty-state">ไม่มีรายการ</td></tr>'}
                  <tr class="total-row deductions-total-row">
                    <td>รวมรายการหัก</td>
                    <td class="text-right total-amount deductions-total-amount">
                      ${totalDeduction.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Net Salary -->
          <div class="net-salary-box">
            <div class="net-salary-content">
              <span class="net-salary-label">เงินได้สุทธิ / Net Salary:</span>
              <span class="net-salary-value">฿ ${netSalary.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Section -->
        <div>
          <!-- Signature -->
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line">
                <div class="signature-title">ผู้จ่ายเงิน / Authorized By</div>
                <div class="signature-date">วันที่ / Date: ........................</div>
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-space"></div>
              <div class="signature-line">
                <div class="signature-title">ผู้รับเงิน / Received By</div>
                <div class="signature-date">วันที่ / Date: ........................</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
          </div>
        </div>
      </div>

    </div>
  </div>
</body>
</html>
    `;

    // Generate PDF ด้วย Puppeteer
    const pdfBuffer = await generatePdf(html);

    // สร้างชื่อไฟล์แบบ safe (ASCII only)
    const safeEmployeeId = employeeId.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `PaySlip_${safeEmployeeId}_${timestamp}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
