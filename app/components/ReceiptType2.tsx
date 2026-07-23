/**
 * ReceiptType2 — ใบเสร็จร้านเช่าชุด
 * ขนาด: ครึ่ง A4 (210mm × 148mm) — พิมพ์บน A4 แล้วตัดครึ่ง
 */

"use client";

import React from "react";

interface CompanyInfo {
  company_name?: string;
  company_name_en?: string;
  address?: string;
  tel?: string;
  tax_id?: string;
  logo_url?: string;
}

interface ReceiptType2Props {
  companyInfo: CompanyInfo;
  receiptNo: string;
  date: string;
  customerName: string;
  customerTel?: string;
  headerFields: { label: string; value: string }[];
  tableHeaders: string[];
  tableRows: string[][];
  footerDetails: { label: string; value: string }[];
  summaryFields: { label: string; value: string }[];
}

const B = "1px solid #1e293b";
const MIN_ROWS = 4;

const dot = (flex?: boolean, w?: number) => (
  <span style={{
    display: "inline-block",
    borderBottom: "1px dotted #64748b",
    ...(flex ? { flex: 1 } : { width: w ?? 80, minWidth: 30 }),
    verticalAlign: "bottom",
    marginLeft: 3,
  }} />
);

export default function ReceiptType2({
  companyInfo, receiptNo, date, customerName, customerTel,
  headerFields, tableHeaders, tableRows, footerDetails, summaryFields,
}: ReceiptType2Props) {

  const displayRows = [...tableRows];
  while (displayRows.length < MIN_ROWS)
    displayRows.push(Array(Math.max(tableHeaders.length, 1)).fill(""));

  const colWidths =
    tableHeaders.length === 3
      ? ["12%", "64%", "24%"]
      : tableHeaders.map(() => `${(100 / tableHeaders.length).toFixed(0)}%`);

  return (
    <div style={{
      fontFamily: "'Sarabun', 'Noto Sans Thai', Arial, sans-serif",
      width: "210mm",
      maxHeight: "165mm",
      padding: "6mm 8mm 5mm",
      background: "#fff",
      color: "#0f172a",
      boxSizing: "border-box",
      margin: "0 auto",
      fontSize: 11,
      overflow: "hidden",
    }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 6, gap: 6 }}>

        {/* วันที่ */}
        <div style={{ minWidth: 80, fontSize: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 1 }}>บิลวันที่ : {dot(false, 44)}</div>
          <div style={{ fontWeight: 700, fontSize: 11, marginTop: 2 }}>{date || ""}</div>
        </div>

        {/* ชื่อร้าน */}
        <div style={{ flex: 1, textAlign: "center" }}>
          {companyInfo.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyInfo.logo_url} alt="logo"
              style={{ maxHeight: 40, maxWidth: 140, objectFit: "contain" }} />
          ) : (
            <div style={{ fontWeight: 900, fontSize: 18, fontStyle: "italic", lineHeight: 1.1 }}>
              {companyInfo.company_name || ""}
            </div>
          )}
          {companyInfo.address && (
            <div style={{ fontSize: 9.5, color: "#374151", marginTop: 2, lineHeight: 1.3 }}>
              {companyInfo.address}
            </div>
          )}
          {companyInfo.tel && (
            <div style={{ fontSize: 9.5, color: "#374151" }}>เบอร์ {companyInfo.tel}</div>
          )}
        </div>

        {/* ขวา balance */}
        <div style={{ minWidth: 80 }} />
      </div>

      {/* ── ข้อมูลลูกค้า ─────────────────────────────────────── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 10.5 }}>
          <div style={{ flex: 3 }}>
            <span style={{ fontWeight: 600 }}>นามลูกค้า : </span>
            <span style={{
              display: "inline-block", borderBottom: "1px dotted #64748b",
              minWidth: 100, paddingBottom: 1, verticalAlign: "bottom",
            }}>{customerName || ""}</span>
          </div>
          <div style={{ flex: 2 }}>
            <span style={{ fontWeight: 600 }}>เบอร์โทร : </span>
            <span style={{
              display: "inline-block", borderBottom: "1px dotted #64748b",
              minWidth: 70, paddingBottom: 1, verticalAlign: "bottom",
            }}>{customerTel || ""}</span>
          </div>
        </div>

        {headerFields.map((f, i) => (
          <div key={i} style={{ marginBottom: 3, fontSize: 10.5 }}>
            <span style={{ fontWeight: 600 }}>{f.label} : </span>
            <span style={{
              display: "inline-block", borderBottom: "1px dotted #64748b",
              minWidth: 120, paddingBottom: 1, verticalAlign: "bottom",
            }}>{f.value}</span>
          </div>
        ))}

        {/* ที่อยู่ + ราคาเช่า label */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, fontSize: 10.5 }}>
          <span style={{ fontWeight: 600 }}>ที่อยู่ : </span>
          <span style={{ flex: 1, borderBottom: "1px dotted #64748b", paddingBottom: 1 }} />
          {tableHeaders.length > 0 && (
            <span style={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: 11 }}>
              {tableHeaders[tableHeaders.length - 1]}
            </span>
          )}
        </div>
      </div>

      {/* ── ตารางรายการ ──────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
        <thead>
          <tr>
            {tableHeaders.map((h, i) => (
              <th key={i} style={{
                border: B, padding: "4px 6px", fontWeight: 700,
                textAlign: "center", background: "#f8fafc", fontSize: 10.5,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, ri) => (
            <tr key={ri} style={{ height: 22 }}>
              {row.map((val, ci) => (
                <td key={ci} style={{
                  border: B, padding: "3px 6px",
                  textAlign: ci === 0 ? "center" : ci === row.length - 1 ? "right" : "left",
                  verticalAlign: "top", fontSize: 10.5,
                }}>{val || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Footer details ───────────────────────────────────── */}
      <div style={{ border: B, borderTop: "none", padding: "5px 8px 2px" }}>
        {footerDetails.map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "baseline", gap: 4,
            marginBottom: 4, fontSize: 10.5,
          }}>
            <span style={{ fontWeight: 600, minWidth: 110 }}>{f.label} :</span>
            <span style={{
              flex: 1, borderBottom: "1px dotted #64748b", paddingBottom: 1,
            }}>{f.value || ""}</span>
          </div>
        ))}

        {summaryFields.map((f, i) => {
          const isLast = i === summaryFields.length - 1;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "baseline", gap: 4,
              marginBottom: isLast ? 2 : 4,
              fontSize: isLast ? 11.5 : 10.5,
            }}>
              <span style={{ fontWeight: 700, minWidth: 110 }}>{f.label} :</span>
              <span style={{
                flex: 1,
                borderBottom: `1px ${isLast ? "solid" : "dotted"} #0f172a`,
                paddingBottom: 1,
                fontWeight: isLast ? 700 : 400,
              }}>{f.value || ""}</span>
              {i === 0 && (
                <span style={{ fontSize: 9.5, color: "#6b7280", whiteSpace: "nowrap" }}>
                  (รับคืนทันทีหลังคืนชุด)
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── ลายเซ็น ──────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ border: B, borderTop: "none", padding: "14px 8px 6px", width: "50%" }}>
              <span style={{ fontSize: 10.5 }}>ลูกค้า : </span>
              <span style={{
                display: "inline-block", borderBottom: "1px dotted #64748b",
                width: "70%", marginLeft: 3,
              }} />
            </td>
            <td style={{ border: B, borderTop: "none", borderLeft: "none", padding: "14px 8px 6px" }}>
              <span style={{ fontSize: 10.5 }}>พนักงานรับเงิน : </span>
              <span style={{
                display: "inline-block", borderBottom: "1px dotted #64748b",
                width: "50%", marginLeft: 3,
              }} />
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}
