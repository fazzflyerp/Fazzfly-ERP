/**
 * =============================================================================
 * FILE: app/components/PayrollSlipPreview.tsx
 * =============================================================================
 * Payroll Slip Preview — Clean Formal A4
 */

"use client";


interface PayrollItem {
  fieldName: string;
  label: string;
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

interface PayrollSlipPreviewProps {
  companyInfo: CompanyInfo;
  payPeriod: string;
  employeeId: string;
  employeeName: string;
  nickname?: string;
  position?: string;
  workingDays?: number;
  leaveDays?: number;
  lateMinutes?: number;
  bankAccount?: string;
  earnings: PayrollItem[];
  deductions: PayrollItem[];
  totalIncome: number;
  totalDeduction: number;
  netSalary: number;
}

const fmt = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollSlipPreview({
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
  earnings,
  deductions,
  totalIncome,
  totalDeduction,
  netSalary,
}: PayrollSlipPreviewProps) {
  const activeEarnings   = earnings.filter(e => e.amount > 0);
  const activeDeductions = deductions.filter(d => d.amount > 0);
  const maxRows = Math.max(activeEarnings.length, activeDeductions.length, 5);

  return (
    <div
      style={{
        fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
        fontSize: 12,
        color: "#000",
        width: "210mm",
        minHeight: "297mm",
        padding: "18mm 20mm 16mm",
        boxSizing: "border-box",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        margin: "0 auto",
        lineHeight: 1.65,
      }}
    >
      {/* ══════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        {/* Company */}
        <div>
          {companyInfo.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyInfo.logo_url} alt="logo" style={{ height: 40, marginBottom: 6 }} />
          )}
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {companyInfo.company_name || "บริษัท ทดสอบ จำกัด"}
          </div>
          {companyInfo.company_name_en && (
            <div style={{ fontSize: 11, color: "#475569" }}>{companyInfo.company_name_en}</div>
          )}
          {companyInfo.address && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{companyInfo.address}</div>
          )}
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
            {companyInfo.tel && <span>โทร {companyInfo.tel}</span>}
            {companyInfo.tel && companyInfo.tax_id && <span style={{ margin: "0 6px" }}>·</span>}
            {companyInfo.tax_id && <span>เลขภาษี {companyInfo.tax_id}</span>}
          </div>
        </div>

        {/* Doc title + period */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>สลิปเงินเดือน</div>
          <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 2, marginBottom: 8 }}>PAY SLIP</div>
          <div style={{ fontSize: 11, border: "1px solid #cbd5e1", padding: "4px 12px", display: "inline-block" }}>
            งวด : <span style={{ fontWeight: 700 }}>{payPeriod}</span>
          </div>
        </div>
      </div>

      {/* เส้นคั่น */}
      <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #000", height: 5, marginBottom: 18 }} />

      {/* ══════════════════════════════════════════════════════
          EMPLOYEE INFO
      ══════════════════════════════════════════════════════ */}
      <div style={{ border: "1px solid #cbd5e1", marginBottom: 18 }}>
        <div style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 0.8, textTransform: "uppercase" }}>
          ข้อมูลพนักงาน
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <EmpCell label="รหัสพนักงาน" value={employeeId} br />
          <EmpCell label="ชื่อ-สกุล" value={`${employeeName}${nickname ? ` (${nickname})` : ""}`} br />
          <EmpCell label="ตำแหน่ง" value={position || "—"} br />
          <EmpCell label="วันทำงาน" value={workingDays ? `${workingDays} วัน` : "—"} />
        </div>
        {bankAccount && (
          <div style={{ borderTop: "1px solid #e2e8f0", padding: "7px 14px", fontSize: 11 }}>
            <span style={{ color: "#64748b" }}>บัญชีธนาคาร : </span>
            <span style={{ fontWeight: 600 }}>{bankAccount}</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          EARNINGS & DEDUCTIONS
      ══════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 0, flex: 1 }}>

        {/* รายได้ */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ border: "1px solid #cbd5e1", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid #cbd5e1", padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 0.8, textTransform: "uppercase", background: "#f8fafc" }}>
              รายได้ / EARNINGS
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, flex: 1 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: "#475569" }}>รายการ</th>
                  <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, color: "#475569", width: 110 }}>จำนวน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {activeEarnings.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px" }}>{item.label}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, maxRows - activeEarnings.length) }).map((_, i) => (
                  <tr key={`ee-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px" }}>&nbsp;</td>
                    <td style={{ padding: "8px 12px" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* รวมรายได้ — ใต้กล่อง */}
          <div style={{ border: "1px solid #cbd5e1", borderTop: "none", display: "flex", justifyContent: "space-between", padding: "8px 12px", fontWeight: 700, fontSize: 12 }}>
            <span>รวมรายได้</span>
            <span>{fmt(totalIncome)}</span>
          </div>
        </div>

        {/* รายการหัก */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ border: "1px solid #cbd5e1", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid #cbd5e1", padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#475569", letterSpacing: 0.8, textTransform: "uppercase", background: "#f8fafc" }}>
              รายการหัก / DEDUCTIONS
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, flex: 1 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: "#475569" }}>รายการ</th>
                  <th style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, color: "#475569", width: 110 }}>จำนวน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {activeDeductions.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px" }}>
                      {item.label}
                      {item.label.includes("วันลา") && leaveDays ? ` (${leaveDays} วัน)` : ""}
                      {item.label.includes("มาสาย") && lateMinutes ? ` (${lateMinutes} นาที)` : ""}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{fmt(item.amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, maxRows - activeDeductions.length) }).map((_, i) => (
                  <tr key={`de-${i}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px" }}>&nbsp;</td>
                    <td style={{ padding: "8px 12px" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* รวมรายการหัก — ใต้กล่อง */}
          <div style={{ border: "1px solid #cbd5e1", borderTop: "none", display: "flex", justifyContent: "space-between", padding: "8px 12px", fontWeight: 700, fontSize: 12 }}>
            <span>รวมรายการหัก</span>
            <span>{fmt(totalDeduction)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }} />

      {/* ══════════════════════════════════════════════════════
          NET SALARY
      ══════════════════════════════════════════════════════ */}
      <div style={{ border: "1px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: "#475569" }}>เงินได้สุทธิ / Net Salary</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>฿ {fmt(netSalary)}</div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ══════════════════════════════════════════════════════
          SIGNATURE
      ══════════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 60px", marginBottom: 14 }}>
        <SignBox label="ผู้จ่ายเงิน / Authorized By" />
        <SignBox label="ผู้รับเงิน / Received By" />
      </div>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <div style={{ paddingTop: 10, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94a3b8" }}>
        <span>เอกสารนี้สร้างโดยระบบอัตโนมัติ / System-generated document</span>
        <span>งวด {payPeriod}</span>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function EmpCell({ label, value, br }: { label: string; value: string; br?: boolean }) {
  return (
    <div style={{ padding: "7px 12px", borderRight: br ? "1px solid #e2e8f0" : undefined }}>
      <div style={{ color: "#64748b", fontSize: 9, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 11 }}>{value}</div>
    </div>
  );
}

function SignBox({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", fontSize: 11 }}>
      <div style={{ height: 52, marginBottom: 6 }} />
      <div style={{ marginBottom: 3 }}>ลงชื่อ ............................................</div>
      <div style={{ marginBottom: 6, color: "#475569" }}>{label}</div>
      <div>
        วันที่{" "}
        <span style={{ display: "inline-block", minWidth: 110, borderBottom: "1px solid #94a3b8" }}>&nbsp;</span>
      </div>
    </div>
  );
}
