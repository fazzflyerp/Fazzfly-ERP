/**
 * =============================================================================
 * FILE PATH: app/api/withholding-tax/generate-pdf/route.ts
 * =============================================================================
 * Generate PDF — หนังสือรับรองการหักภาษี ณ ที่จ่าย
 */

import { NextRequest, NextResponse } from "next/server";
import { generatePdf } from "@/lib/pdf-browser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyInfo, transaction: tx } = body;

    const fmt = (n: any) =>
      Number(n)
        ? Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })
        : "0.00";

    const bahtText = (amount: number): string => {
      if (isNaN(amount) || amount === 0) return "ศูนย์บาทถ้วน";
      const ones = ["","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
      const readBlock = (n: number): string => {
        if (n === 0) return "";
        const d = [Math.floor(n/100000),Math.floor((n%100000)/10000),Math.floor((n%10000)/1000),Math.floor((n%1000)/100),Math.floor((n%100)/10),n%10];
        const lb = ["แสน","หมื่น","พัน","ร้อย","สิบ",""];
        let s = "";
        for (let i = 0; i < 6; i++) {
          if (d[i] === 0) continue;
          if (i === 4) { if (d[i]===1){s+="สิบ";continue;} if (d[i]===2){s+="ยี่สิบ";continue;} }
          if (i === 5 && d[i]===1 && d[4]>0){s+="เอ็ด";continue;}
          s += ones[d[i]] + lb[i];
        }
        return s;
      };
      const neg = amount < 0;
      const abs = Math.abs(amount);
      const [intStr, decStr] = abs.toFixed(2).split(".");
      const intNum = parseInt(intStr);
      const satang = parseInt(decStr);
      const millions = Math.floor(intNum / 1000000);
      const rest = intNum % 1000000;
      let result = neg ? "ลบ" : "";
      if (millions > 0) result += readBlock(millions) + "ล้าน";
      result += readBlock(rest) || (intNum === 0 ? "ศูนย์" : "");
      result += "บาท";
      result += satang > 0 ? readBlock(satang) + "สตางค์" : "ถ้วน";
      return result;
    };

    const price = parseFloat((tx.service_price ?? "0").toString().replace(/,/g, "")) || 0;
    const tax   = parseFloat((tx.service_tax_price ?? "0").toString().replace(/,/g, "")) || 0;

    const toThaiDate = (dateStr: string): string => {
      if (!dateStr) return "-";
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const year = parseInt(parts[2]);
        if (!isNaN(year) && year >= 2100 && year <= 2700) return dateStr;
        if (!isNaN(year) && year >= 1900) return `${parts[0]}/${parts[1]}/${year + 543}`;
      }
      const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const y = parseInt(iso[1]);
        return `${parseInt(iso[3])}/${parseInt(iso[2])}/${y >= 1900 ? y + 543 : y}`;
      }
      return dateStr;
    };

    const serviceType = (tx.service_type || "ค่าจ้าง").toString();
    const isKhaJang   = serviceType.includes("ค่าจ้าง");
    const thaiDate    = toThaiDate(tx.date || "");

    const cb = (checked: boolean) =>
      `<span style="display:inline-block;width:11px;height:11px;border:1px solid #555;margin-right:3px;text-align:center;font-size:9px;line-height:11px;">${checked ? "✓" : ""}</span>`;

    const staticRows = [
      "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)",
      "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)",
      "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)",
      "4. (ก) ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40(4) (ก)",
      "    (ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)",
      "    (1) กิจการที่ต้องเสียภาษีเงินได้บุคคลธรรมดาในอัตราดังนี้",
      "        □ อัตราร้อยละ 30 ของกำไรสุทธิ",
      "        □ อัตราร้อยละ 25 ของกำไรสุทธิ",
      "        □ อัตราร้อยละ 20 ของกำไรสุทธิ",
      "        □ อัตราอื่น ๆ ระบุ ____________ ของกำไรสุทธิ",
      "    (2) กิจการที่ได้รับยกเว้นภาษีเงินได้บุคคลบุคคล ซึ่งผู้รับเงินปันผลไม่ได้รับผลประโยชน์ภาษี",
      "    (3) กำไรเฉพาะส่วนที่ได้รับยกเว้นเงินได้นำมาคำนวณมาจนมีการจ่ายให้แก่ผู้ถือหุ้น ซึ่งได้รับเงินปันผลไม่ได้รับผลประโยชน์ภาษี",
    ];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', sans-serif; color: #000; font-size: 12px; line-height: 1.5; }
    .page { width: 210mm; min-height: 297mm; padding: 12mm 14mm; background: white; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .section { border: 1px solid #64748b; padding: 10px 12px; margin-bottom: 8px; }
    .section-title { font-weight: 700; font-size: 12px; margin-bottom: 6px; }
    .row-between { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 3px; }
    .hint { font-size: 9px; color: #555; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
    th, td { border: 1px solid #64748b; padding: 4px 8px; }
    th { background: #f1f5f9; font-weight: 700; text-align: center; }
    .cb-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; font-size: 11px; flex-wrap: wrap; border: 1px solid #64748b; padding: 6px 10px; }
    .social-row { display: flex; align-items: center; gap: 8px; border: 1px solid #64748b; padding: 6px 10px; margin-bottom: 8px; font-size: 11px; }
    .spacer { flex: 1; border-bottom: 1px solid #64748b; }
    .payer-row { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; font-size: 11px; flex-wrap: wrap; }
    .certify { text-align: center; font-size: 11px; margin-bottom: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .sig { text-align: center; font-size: 11px; margin-bottom: 16px; }
    .remark { font-size: 10px; color: #333; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .remark strong { color: #000; }
  </style>
</head>
<body>
<div class="page">

  <!-- Title -->
  <div class="text-center" style="margin-bottom:6px">
    <div class="font-bold" style="font-size:14px">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
    <div style="font-size:11px">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
  </div>
  <div class="text-right" style="font-size:11px;margin-bottom:10px">เลขที่ <strong>${tx.recipt_no || "-"}</strong></div>

  <!-- ผู้มีหน้าที่หักภาษี -->
  <div class="section">
    <div class="section-title">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :</div>
    <div class="row-between">
      <div><span style="color:#64748b">ชื่อ </span><strong>${companyInfo?.company_name || "-"}</strong></div>
      <div><span style="color:#64748b">เลขประจำตัวผู้เสียภาษีอากร </span><strong>${companyInfo?.tax_id || "-"}</strong></div>
    </div>
    <div class="hint">(ให้ระบุว่าเป็นบุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</div>
    <div style="margin-bottom:3px"><span style="color:#64748b">ที่อยู่ </span>${companyInfo?.address || "-"}</div>
    <div class="hint">(ให้ระบุสำหรับกรณีบ้าน ห้องเลขที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
  </div>

  <!-- ผู้ถูกหักภาษี -->
  <div class="section">
    <div class="section-title">ผู้ถูกหักภาษี ณ ที่จ่าย :</div>
    <div class="row-between">
      <div><span style="color:#64748b">ชื่อ </span><strong>${tx.dealer_name || "-"}</strong></div>
      <div><span style="color:#64748b">เลขบัตรประชาชน/เลขผู้เสียภาษีอากร </span><strong>${tx.cust_tax_no || "-"}</strong></div>
    </div>
    <div style="margin-bottom:3px"><span style="color:#64748b">ที่อยู่ </span>${tx.cust_address || "-"}</div>
    <div class="hint">(ให้ระบุสำหรับกรณีบ้าน ห้องเลขที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
  </div>

  <!-- ลำดับที่ -->
  <div class="cb-row">
    <span class="font-bold">ลำดับที่ *</span>
    <label>${cb(true)}ในแบบ</label>
    <label>${cb(false)}ภ.ง.ด.1ก</label>
    <label>${cb(false)}ภ.ง.ด.1ก พิเศษ</label>
    <label>${cb(false)}ภ.ง.ด.2</label>
    <label>${cb(isKhaJang)}ภ.ง.ด.3</label>
    <label>${cb(false)}ภ.ง.ด.2ก</label>
    <label>${cb(false)}ภ.ง.ด.3ก</label>
    <label>${cb(!isKhaJang)}ภ.ง.ด.53</label>
  </div>

  <!-- ตารางรายการ -->
  <table>
    <colgroup>
      <col style="width:55%"/>
      <col style="width:16%"/>
      <col style="width:15%"/>
      <col style="width:14%"/>
    </colgroup>
    <thead>
      <tr>
        <th style="text-align:left">ประเภทเงินได้ที่จ่าย</th>
        <th>วัน เดือน ปี<br/>ที่จ่าย</th>
        <th class="text-right">จำนวนเงิน<br/>ที่จ่าย</th>
        <th class="text-right">ภาษี<br/>หัก ณ ที่จ่าย</th>
      </tr>
    </thead>
    <tbody>
      ${staticRows.map(label => `
      <tr>
        <td style="white-space:pre-wrap">${label}</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>`).join("")}
      <tr>
        <td>5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น ราวรัส ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย รางวัลจากการประกวด การแข่งขัน ชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>
      <!-- Dynamic data row -->
      <tr>
        <td class="font-bold">${serviceType}</td>
        <td class="text-center">${thaiDate}</td>
        <td class="text-right">${fmt(price)}</td>
        <td class="text-right">${fmt(tax)}</td>
      </tr>
      <tr>
        <td>6. อื่น ๆ ระบุ _______________________________________________</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
      </tr>
      <tr class="font-bold">
        <td colspan="2" class="text-right">รวมเงินที่จ่ายและภาษีที่นำส่ง</td>
        <td class="text-right">${fmt(price)}</td>
        <td class="text-right">${fmt(tax)}</td>
      </tr>
    </tbody>
  </table>

  <!-- รวมเงินภาษี -->
  <div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:8px">
    <span class="font-bold">รวมเงินภาษีที่หักนำส่ง</span>
    <span class="font-bold" style="padding:0 8px">(${bahtText(tax)})</span>
    <span style="flex:1"></span>
    <span class="font-bold">บาท</span>
  </div>

  <!-- ช่องว่าง -->
  <div style="margin-bottom:12px"></div>

  <!-- ผู้จ่ายเงิน -->
  <div class="payer-row">
    <span class="font-bold">ผู้จ่ายเงิน</span>
    <label>${cb(false)}ออกภาษีให้ครั้งเดียว</label>
    <label>${cb(false)}ออกภาษีให้ตลอดไป</label>
    <label>${cb(true)}ทักษะ ณ ที่จ่าย</label>
    <label>${cb(false)}อื่น ๆ ........</label>
  </div>

  <!-- คำรับรอง -->
  <div class="certify">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความเป็นจริงทุกประการ</div>

  <!-- ลงชื่อ -->
  <div class="sig">
    <div style="margin-bottom:4px">ลงชื่อ ................................................................ ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
    <div style="margin-bottom:2px">${thaiDate}</div>
    <div style="font-size:10px;color:#94a3b8">วัน ปี ที่ออกทางหนังสือรับรอง</div>
  </div>

  <!-- หมายเหตุ -->
  <div class="remark">
    <p><strong>หมายเหตุ *</strong> ให้สามารถอ้างอิงหลักฐานยืนยันอันได้ตระหว่างที่จำเป็นตามที่กำหนดในหนังสือรับรอง ถ้าแบบนี้สร้างระหว่างที่ทำตามหนังสือรับรอง ถ้าแบบอื่นๆ นอกจากที่กรมสรรพากรกำหนด โดยอนุมัติของกรมสรรพากรก็ใช้แบบอื่นๆ แทนได้</p>
    <p style="margin-top:4px"><strong>คำเตือน</strong> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญา ตามมาตรา 35 แห่งประมวลรัษฎากร</p>
  </div>

</div>
</body>
</html>`;

    const pdfBuffer = await generatePdf(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="WT_${tx.recipt_no || "doc"}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("❌ WT PDF error:", error.message);
    return NextResponse.json(
      { error: "PDF generation failed: " + error.message },
      { status: 500 }
    );
  }
}
