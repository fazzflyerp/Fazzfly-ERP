/**
 * =============================================================================
 * FILE PATH: app/components/ReceiptPreview.tsx
 * =============================================================================
 * Receipt Preview — รูปแบบทางการ A4
 */

"use client";

import React from "react";

interface ReceiptItem {
  description: string;
  quantity: number;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
}

interface PaymentMethod {
  method: string;
  amount: number;
}

interface CompanyInfo {
  company_name?: string;
  company_name_en?: string;
  address?: string;
  tel?: string;
  tax_id?: string;
  logo_url?: string;
}

interface ReceiptPreviewProps {
  hasVAT?: boolean;
  companyInfo: CompanyInfo;
  receiptNo: string;
  date: string;
  customerId: string;
  customerName: string;
  customerTel?: string;
  customerAddress?: string;
  items: ReceiptItem[];
  subtotal_before_vat: number;
  total_vat: number;
  total_after_vat: number;
  paymentMethods: PaymentMethod[];
}

const fmt = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

const LINE = () => (
  <div style={{ borderBottom: "1px solid #94a3b8", flex: 1 }} />
);

export default function ReceiptPreview({
  hasVAT = true,
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
}: ReceiptPreviewProps) {
  const colCount = hasVAT ? 6 : 4;

  return (
    <div
      className="bg-white text-black mx-auto flex flex-col"
      style={{
        fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
        fontSize: 12,
        color: "#000",
        width: "210mm",
        minHeight: "297mm",
        padding: "16mm 18mm 14mm",
        boxSizing: "border-box",
        lineHeight: 1.6,
      }}
    >

      {/* ═══════════════════════════════════════════════════════
          HEADER — บริษัท
      ════════════════════════════════════════════════════════ */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        {companyInfo.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={companyInfo.logo_url} alt="logo" style={{ height: 48, margin: "0 auto 6px" }} />
        )}
        <div style={{ fontWeight: 700, fontSize: 15 }}>{companyInfo.company_name || "บริษัท ทดสอบ จำกัด"}</div>
        {companyInfo.company_name_en && (
          <div style={{ fontSize: 11 }}>{companyInfo.company_name_en}</div>
        )}
        {companyInfo.address && (
          <div style={{ fontSize: 11, marginTop: 2 }}>{companyInfo.address}</div>
        )}
        <div style={{ fontSize: 11, marginTop: 2 }}>
          {companyInfo.tel && <span>โทร {companyInfo.tel}</span>}
          {companyInfo.tel && companyInfo.tax_id && <span style={{ margin: "0 8px" }}>|</span>}
          {companyInfo.tax_id && <span>เลขประจำตัวผู้เสียภาษี {companyInfo.tax_id}</span>}
        </div>
      </div>

      {/* ─── เส้นคั่น ─────────────────────────────────────────── */}
      <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #000", padding: "5px 0", textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 2 }}>ใบเสร็จรับเงิน</div>
        <div style={{ fontSize: 11 }}>RECEIPT</div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          เลขที่ / วันที่
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 12 }}>
        <div>เลขที่ / No. &nbsp;<strong>{receiptNo || "-"}</strong></div>
        <div>วันที่ / Date &nbsp;<strong>{date || "-"}</strong></div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ผู้ออกใบเสร็จ + ผู้ชำระเงิน — กล่องเดียว 2 คอลัมน์
      ════════════════════════════════════════════════════════ */}
      <div style={{ border: "1px solid #64748b", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {/* ผู้ออกใบเสร็จ */}
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, fontSize: 11, borderBottom: "1px solid #e2e8f0", paddingBottom: 4, marginBottom: 6 }}>
              ผู้ออกใบเสร็จ
            </div>
            <InfoRow label="ชื่อ" value={companyInfo.company_name} />
            <InfoRow label="เลขภาษี" value={companyInfo.tax_id} />
            {companyInfo.address && <InfoRow label="ที่อยู่" value={companyInfo.address} />}
            {companyInfo.tel && <InfoRow label="โทร" value={companyInfo.tel} />}
          </div>

          {/* ผู้ชำระเงิน */}
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, fontSize: 11, borderBottom: "1px solid #e2e8f0", paddingBottom: 4, marginBottom: 6 }}>
              ผู้ชำระเงิน
            </div>
            <InfoRow label="ชื่อ" value={customerName} />
            <InfoRow label="รหัสลูกค้า" value={customerId} />
            {customerTel && <InfoRow label="โทร" value={customerTel} />}
            {customerAddress && <InfoRow label="ที่อยู่" value={customerAddress} />}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          ตารางรายการ
      ════════════════════════════════════════════════════════ */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, tableLayout: "fixed", fontSize: 12 }}>
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: hasVAT ? "40%" : "62%" }} />
          <col style={{ width: "8%" }} />
          {hasVAT ? (
            <>
              <col style={{ width: "15%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "18%" }} />
            </>
          ) : (
            <col style={{ width: "24%" }} />
          )}
        </colgroup>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <Th center>ลำดับ</Th>
            <Th>รายการ / Description</Th>
            <Th center>จำนวน</Th>
            {hasVAT ? (
              <>
                <Th right>ก่อนภาษี (บาท)</Th>
                <Th right>ภาษี 7%</Th>
                <Th right>รวม (บาท)</Th>
              </>
            ) : (
              <Th right>จำนวนเงิน (บาท)</Th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <Td center>{i + 1}</Td>
              <Td>{item.description}</Td>
              <Td center>{item.quantity}</Td>
              {hasVAT ? (
                <>
                  <Td right>{fmt(item.amount_before_vat)}</Td>
                  <Td right>{fmt(item.vat_amount)}</Td>
                  <Td right>{fmt(item.amount_after_vat)}</Td>
                </>
              ) : (
                <Td right>{fmt(item.amount_after_vat)}</Td>
              )}
            </tr>
          ))}
          {/* แถวว่างเสริม สำหรับหน้าสั้น */}
          {items.length < 6 &&
            Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                {Array.from({ length: colCount }).map((__, j) => (
                  <Td key={j}>&nbsp;</Td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {/* ═══════════════════════════════════════════════════════
          ยอดรวม — ขวา
      ════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ width: 280 }}>
          {hasVAT && (
            <>
              <SummaryRow label="ยอดรวมก่อนภาษี" value={fmt(subtotal_before_vat) + " บาท"} />
              <SummaryRow label="ภาษีมูลค่าเพิ่ม 7%" value={fmt(total_vat) + " บาท"} />
            </>
          )}
          <SummaryRow label="ยอดรวมทั้งสิ้น" value={fmt(total_after_vat) + " บาท"} bold border />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          วิธีการชำระเงิน — ล่าง
      ════════════════════════════════════════════════════════ */}
      {paymentMethods.length > 0 && (
        <div style={{ border: "1px solid #64748b", padding: "10px 14px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>วิธีการชำระเงิน / Payment Method</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 24px" }}>
            {paymentMethods.map((p, i) => (
              <React.Fragment key={i}>
                <span style={{ fontSize: 12 }}>{p.method}</span>
                <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{fmt(p.amount)} บาท</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* ─── Spacer ─────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ═══════════════════════════════════════════════════════
          คำรับรอง + ลายเซ็น
      ════════════════════════════════════════════════════════ */}
      <div style={{ paddingTop: 10, marginBottom: 10, textAlign: "center", fontSize: 11 }}>
        ขอรับรองว่าได้รับเงินตามรายการข้างต้นถูกต้องครบถ้วนแล้ว
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 60px" }}>
        <SignatureBox label="ผู้รับเงิน / Receiver" date={date} />
        <SignatureBox label="ผู้จ่ายเงิน / Payer" />
      </div>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <div style={{ textAlign: "center", marginTop: 16, paddingTop: 10, borderTop: "1px solid #cbd5e1", fontSize: 10 }}>
        ขอบคุณที่ใช้บริการ / Thank you for your business
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 11, marginBottom: 2 }}>
      <span style={{ color: "#475569", whiteSpace: "nowrap" }}>{label} : </span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Th({ children, center, right }: { children: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <th
      style={{
        border: "1px solid #64748b",
        padding: "6px 8px",
        fontWeight: 700,
        fontSize: 11,
        textAlign: center ? "center" : right ? "right" : "left",
        color: "#000",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, center, right }: { children?: React.ReactNode; center?: boolean; right?: boolean }) {
  return (
    <td
      style={{
        border: "1px solid #64748b",
        padding: "7px 8px",
        fontSize: 12,
        textAlign: center ? "center" : right ? "right" : "left",
        color: "#000",
      }}
    >
      {children ?? "\u00a0"}
    </td>
  );
}

function SummaryRow({ label, value, bold, border }: { label: string; value: string; bold?: boolean; border?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "5px 8px",
        borderTop: border ? "2px solid #000" : "1px solid #e2e8f0",
        fontWeight: bold ? 700 : 400,
        fontSize: bold ? 13 : 12,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SignatureBox({ label, date }: { label: string; date?: string }) {
  return (
    <div style={{ textAlign: "center", fontSize: 11 }}>
      {/* พื้นที่เซ็น — ไม่มีเส้น */}
      <div style={{ height: 64, marginBottom: 6 }} />
      <div style={{ marginBottom: 3 }}>ลงชื่อ ............................................</div>
      <div style={{ marginBottom: 6 }}>{label}</div>
      <div>
        วันที่{" "}
        <span style={{ borderBottom: "1px solid #94a3b8", paddingBottom: 1, minWidth: 100, display: "inline-block" }}>
          {date || "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"}
        </span>
      </div>
    </div>
  );
}
