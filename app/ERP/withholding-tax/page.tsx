/**
 * =============================================================================
 * FILE PATH: app/ERP/withholding-tax/page.tsx
 * =============================================================================
 * หน้าออกหนังสือรับรองการหักภาษี ณ ที่จ่าย (WT)
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";

interface MappedTransaction {
  [key: string]: any;
  _rowIndex: number;
}

export default function WithholdingTaxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const moduleId = searchParams.get("moduleId");
  const spreadsheetId = searchParams.get("spreadsheetId");
  const configName = searchParams.get("configName");
  const sheetName = searchParams.get("sheetName");

  const [config, setConfig] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<MappedTransaction[]>([]);
  const [selected, setSelected] = useState<MappedTransaction | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Load config + transactions
  useEffect(() => {
    if (status !== "authenticated" || !moduleId || !spreadsheetId) return;
    loadData();
  }, [status, moduleId, spreadsheetId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const accessToken = (session as any)?.accessToken;

      // 1. หา module info จาก documents API (เหมือน receipt)
      const userRes = await fetch("/api/user/modules", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error("โหลด user modules ไม่สำเร็จ");
      const userData = await userRes.json();

      const docsRes = await fetch(`/api/user/documents?clientId=${userData.clientId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!docsRes.ok) throw new Error("โหลด documents ไม่สำเร็จ");
      const docsData = await docsRes.json();
      const module = docsData.documents.find((d: any) => d.moduleId === moduleId);
      if (!module) throw new Error("ไม่พบ module");

      // 2. config — ใช้ /api/receipt/config เหมือน receipt
      const cfgRes = await fetch(
        `/api/receipt/config?spreadsheetId=${spreadsheetId}&configName=${encodeURIComponent(module.configName)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!cfgRes.ok) throw new Error("โหลด config ไม่สำเร็จ");
      const cfgData = await cfgRes.json();
      const fields: any[] = cfgData.fields || [];
      setConfig(fields);

      // 3. transactions — ใช้ /api/receipt/transactions เหมือน receipt
      const txRes = await fetch(
        `/api/receipt/transactions?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(module.sheetName)}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
      );
      if (!txRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const txData = await txRes.json();
      const rawTx: { rowIndex: number; data: any[] }[] = txData.transactions || [];

      // map เหมือน receipt: field.order เป็น column index (1-based)
      const mapped: MappedTransaction[] = rawTx.map((tx) => {
        const obj: MappedTransaction = { _rowIndex: tx.rowIndex };
        fields.forEach((f) => {
          obj[f.fieldName] = f.order != null ? (tx.data[f.order - 1] ?? "") : "";
        });
        return obj;
      });
      setTransactions(mapped);

      // 4. company info
      const coRes = await fetch(
        `/api/receipt/company-info?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(module.salesReceiptData || "company_info")}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (coRes.ok) setCompanyInfo((await coRes.json()).companyInfo);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = transactions
    .filter((tx) => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      return (
        (tx.recipt_no ?? "").toString().toLowerCase().includes(term) ||
        (tx.dealer_name ?? "").toString().toLowerCase().includes(term) ||
        (tx.service_type ?? "").toString().toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      try {
        const parse = (d: string) => new Date(d.split("/").reverse().join("-")).getTime();
        return sortOrder === "newest" ? parse(b.date) - parse(a.date) : parse(a.date) - parse(b.date);
      } catch { return 0; }
    });

  async function handleDownloadPDF(tx: MappedTransaction) {
    setLoadingPDF(true);
    try {
      const res = await fetch("/api/withholding-tax/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyInfo, transaction: tx }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `WT_${tx.recipt_no || tx._rowIndex}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("❌ " + e.message);
    } finally {
      setLoadingPDF(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-600 animate-spin" />
          </div>
          <p className="text-slate-600 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <a href="/ERP/home" className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">กลับหน้าหลัก</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <QuickNavTrigger onClick={() => setNavOpen(true)} />
            <a href="/ERP/home" className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-sm font-bold text-slate-800 truncate">หนังสือรับรองการหักภาษี ณ ที่จ่าย</h1>
          </div>
          <span className="text-xs text-slate-500 font-semibold hidden sm:block flex-shrink-0">{transactions.length} รายการ</span>
        </div>
      </div>

      {/* Main 2-col */}
      <div className="h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-2">

        {/* Left: list */}
        <div className="flex flex-col border-r border-slate-200 overflow-hidden">
          {/* Filters */}
          <div className="flex-none px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {(["newest", "oldest"] as const).map((order) => (
                <button key={order} onClick={() => setSortOrder(order)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortOrder === order ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {order === "newest" ? "ใหม่→เก่า" : "เก่า→ใหม่"}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="ค้นหาเลขที่ / ชื่อ / บริการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[80px] px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">ไม่มีรายการ</p>
              </div>
            ) : filtered.map((tx) => {
              const isSelected = selected?._rowIndex === tx._rowIndex;
              return (
                <div
                  key={tx._rowIndex}
                  onClick={() => setSelected(tx)}
                  className={`rounded-xl border cursor-pointer transition-all px-3 py-2.5 ${isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800">{tx.recipt_no || `#${tx._rowIndex}`}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{tx.date || ""}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate mb-1">{tx.dealer_name || "ไม่ระบุชื่อ"}</div>
                  <div className="text-[10px] text-slate-400 truncate">{tx.service_type || ""}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex flex-col overflow-hidden bg-slate-50">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium">เลือกรายการเพื่อดูรายละเอียด</p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="flex-none px-3 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">เลขที่</p>
                    <p className="text-base font-bold text-slate-800">{selected.recipt_no || `#${selected._rowIndex}`}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">ยอดภาษี</p>
                    <p className="text-base font-bold text-blue-600">
                      ฿{Number(selected.service_tax_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-2.5">
                  <div><span className="text-slate-400">วันที่: </span>{selected.date || "-"}</div>
                  <div><span className="text-slate-400">ผู้ถูกหัก: </span><span className="font-semibold">{selected.dealer_name || "-"}</span></div>
                  <div className="col-span-2 truncate"><span className="text-slate-400">บริการ: </span>{selected.service_type || "-"}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    พรีวิว
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(selected)}
                    disabled={loadingPDF}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {loadingPDF ? (
                      <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />กำลังสร้าง...</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>ดาวน์โหลด PDF</>
                    )}
                  </button>
                </div>
              </div>

              {/* Field list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <div className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                  <div className="space-y-1">
                    {config.filter(f => f.order != null).map((field, fi) => (
                      <div key={`${field.fieldName}-${fi}`} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">{field.label}</span>
                        <span className="font-semibold text-slate-700">{selected[field.fieldName] || "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">ตัวอย่างเอกสาร</h3>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <WTPreview companyInfo={companyInfo} tx={selected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thai Baht Text (BAHTTEXT) ────────────────────────────────────────────────
function bahtText(amount: number): string {
  if (isNaN(amount) || amount === 0) return "ศูนย์บาทถ้วน";
  const ones = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  function readBlock(n: number): string {
    if (n === 0) return "";
    const digits = [
      Math.floor(n / 100000),
      Math.floor((n % 100000) / 10000),
      Math.floor((n % 10000) / 1000),
      Math.floor((n % 1000) / 100),
      Math.floor((n % 100) / 10),
      n % 10,
    ];
    const labels = ["แสน", "หมื่น", "พัน", "ร้อย", "สิบ", ""];
    let s = "";
    for (let i = 0; i < 6; i++) {
      if (digits[i] === 0) continue;
      if (i === 4) { // สิบ
        if (digits[i] === 1) { s += "สิบ"; continue; }
        if (digits[i] === 2) { s += "ยี่สิบ"; continue; }
      }
      if (i === 5 && digits[i] === 1 && digits[4] > 0) { s += "เอ็ด"; continue; }
      s += ones[digits[i]] + labels[i];
    }
    return s;
  }
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
}

// ─── Preview Component ────────────────────────────────────────────────────────
function toThaiDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const year = parseInt(parts[2]);
    if (!isNaN(year) && year >= 2100 && year <= 2700) return dateStr; // already BE
    if (!isNaN(year) && year >= 1900) return `${parts[0]}/${parts[1]}/${year + 543}`;
  }
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = parseInt(iso[1]);
    return `${parseInt(iso[3])}/${parseInt(iso[2])}/${y >= 1900 ? y + 543 : y}`;
  }
  return dateStr;
}

function WTPreview({ companyInfo, tx }: { companyInfo: any; tx: MappedTransaction }) {
  const fmt = (n: any) => {
    const num = parseFloat((n ?? "0").toString().replace(/,/g, ""));
    return isNaN(num) ? "0.00" : num.toLocaleString("th-TH", { minimumFractionDigits: 2 });
  };
  const price = parseFloat((tx.service_price ?? "0").toString().replace(/,/g, "")) || 0;
  const tax = parseFloat((tx.service_tax_price ?? "0").toString().replace(/,/g, "")) || 0;
  const serviceType = (tx.service_type || "ค่าจ้าง").toString();
  const isKhaJang = serviceType.includes("ค่าจ้าง");
  const thaiDate = toThaiDate(tx.date || "");

  const CB = ({ checked }: { checked?: boolean }) => (
    <span style={{ display: "inline-block", width: 12, height: 12, border: "1px solid #555", marginRight: 3, textAlign: "center", fontSize: 10, lineHeight: "12px" }}>
      {checked ? "✓" : ""}
    </span>
  );

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden" style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 12, color: "#000" }}>
      <div className="p-8">

        {/* Title */}
        <div className="text-center mb-1">
          <div className="font-bold text-sm text-black">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
          <div className="text-xs text-black">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
        </div>
        <div className="text-right text-xs mb-3 text-black">เลขที่ <span className="font-bold">{tx.recipt_no || "-"}</span></div>

        {/* ผู้มีหน้าที่หักภาษี */}
        <div className="border border-slate-400 p-3 mb-2">
          <div className="font-bold text-xs mb-1 text-black">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :</div>
          <div className="flex justify-between gap-4 text-xs mb-0.5">
            <div><span className="text-black">ชื่อ </span><span className="font-semibold text-black">{companyInfo?.company_name || "-"}</span></div>
            <div className="text-right flex-shrink-0"><span className="text-black">เลขประจำตัวผู้เสียภาษีอากร </span><span className="font-semibold text-black">{companyInfo?.tax_id || "-"}</span></div>
          </div>
          <div className="text-[10px] text-slate-500 mb-1">(ให้ระบุว่าเป็นบุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</div>
          <div className="text-xs mb-0.5 text-black"><span>ที่อยู่ </span>{companyInfo?.address || "-"}</div>
          <div className="text-[10px] text-slate-500">(ให้ระบุสำหรับกรณีบ้าน ห้องเลขที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
        </div>

        {/* ผู้ถูกหักภาษี */}
        <div className="border border-slate-400 p-3 mb-2">
          <div className="font-bold text-xs mb-1 text-black">ผู้ถูกหักภาษี ณ ที่จ่าย :</div>
          <div className="flex justify-between gap-4 text-xs mb-0.5">
            <div><span className="text-black">ชื่อ </span><span className="font-semibold text-black">{tx.dealer_name || "-"}</span></div>
            <div className="text-right flex-shrink-0"><span className="text-black">เลขบัตรประชาชน/เลขผู้เสียภาษีอากร </span><span className="font-semibold text-black">{tx.cust_tax_no || "-"}</span></div>
          </div>
          <div className="text-xs mb-0.5 text-black"><span>ที่อยู่ </span>{tx.cust_address || "-"}</div>
          <div className="text-[10px] text-slate-500">(ให้ระบุสำหรับกรณีบ้าน ห้องเลขที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
        </div>

        {/* ลำดับที่ */}
        <div className="flex items-center gap-4 text-xs border border-slate-400 px-3 py-2 mb-2 flex-wrap">
          <span className="font-semibold">ลำดับที่ *</span>
          <label className="flex items-center gap-1"><CB checked />ในแบบ</label>
          <label className="flex items-center gap-1"><CB />ภ.ง.ด.1ก</label>
          <label className="flex items-center gap-1"><CB />ภ.ง.ด.1ก พิเศษ</label>
          <label className="flex items-center gap-1"><CB />ภ.ง.ด.2</label>
          <label className="flex items-center gap-1"><CB checked={isKhaJang} />ภ.ง.ด.3</label>
          <label className="flex items-center gap-1"><CB />ภ.ง.ด.2ก</label>
          <label className="flex items-center gap-1"><CB />ภ.ง.ด.3ก</label>
          <label className="flex items-center gap-1"><CB checked={!isKhaJang} />ภ.ง.ด.53</label>
        </div>

        {/* ตารางรายการ */}
        <table className="w-full border-collapse text-xs mb-2" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "55%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-400 px-2 py-1 text-left">ประเภทเงินได้ที่จ่าย</th>
              <th className="border border-slate-400 px-2 py-1 text-center">วัน เดือน ปี<br />ที่จ่าย</th>
              <th className="border border-slate-400 px-2 py-1 text-right">จำนวนเงิน<br />ที่จ่าย</th>
              <th className="border border-slate-400 px-2 py-1 text-right">ภาษี<br />หัก ณ ที่จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {[
              "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)",
              "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)",
              "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)",
              "4. (ก) ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40(4) (ก)",
              "    (ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)",
              "    (1) กิจการที่ต้องเสียภาษีเงินได้บุคคลธรรมดาในอัตราดังนี้",
              "        \u25a1 อัตราร้อยละ 30 ของกำไรสุทธิ",
              "        \u25a1 อัตราร้อยละ 25 ของกำไรสุทธิ",
              "        \u25a1 อัตราร้อยละ 20 ของกำไรสุทธิ",
              "        \u25a1 อัตราอื่น ๆ ระบุ ____________ ของกำไรสุทธิ",
              "    (2) กิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล ซึ่งผู้รับเงินปันผลไม่ได้รับเครดิตภาษี",
              "    (3) กำไรเฉพาะส่วนที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณภาษีเงินได้นิติบุคคลซึ่งผู้รับเงินปันผลไม่ได้รับเครดิตภาษี",
            ].map((label, i) => (
              <tr key={i}>
                <td className="border border-slate-400 px-2 py-0.5 whitespace-pre-wrap text-black">{label}</td>
                <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
                <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
                <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
              </tr>
            ))}
            <tr>
              <td className="border border-slate-400 px-2 py-0.5 leading-relaxed text-black">
                5. การชำระเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส
                3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใด ๆ เนื่องจากการส่งเสริมการขาย
                รางวัลในการประกวด การแข่งขัน การชิงโชค คำแสดงของนักแสดงสาธารณะ
                ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ
              </td>
              <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
              <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
              <td className="border border-slate-400 px-2 py-0.5">&nbsp;</td>
            </tr>
            {/* Dynamic row */}
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold text-black">{serviceType}</td>
              <td className="border border-slate-400 px-2 py-1 text-center text-black">{thaiDate}</td>
              <td className="border border-slate-400 px-2 py-1 text-right text-black">{fmt(price)}</td>
              <td className="border border-slate-400 px-2 py-1 text-right text-black">{fmt(tax)}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 text-black">6. อื่น ๆ ระบุ _______________________________________________</td>
              <td className="border border-slate-400 px-2 py-1">&nbsp;</td>
              <td className="border border-slate-400 px-2 py-1">&nbsp;</td>
              <td className="border border-slate-400 px-2 py-1">&nbsp;</td>
            </tr>
            <tr className="font-bold">
              <td colSpan={2} className="border border-slate-400 px-2 py-1 text-right text-black">รวมเงินที่จ่ายและภาษีที่นำส่ง</td>
              <td className="border border-slate-400 px-2 py-1 text-right text-black">{fmt(price)}</td>
              <td className="border border-slate-400 px-2 py-1 text-right text-black">{fmt(tax)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-center gap-2 text-xs mb-2 text-black">
          <span className="font-semibold">รวมเงินภาษีที่หักนำส่ง</span>
          <span className="font-semibold px-2">({bahtText(tax)})</span>
          <span className="flex-1" />
          <span className="font-semibold"> </span>
        </div>

        {/* ช่องว่างแทน ค่าประกันสังคม */}
        <div className="mb-3" />

        {/* ผู้จ่ายเงิน */}
        <div className="flex items-center gap-4 text-xs mb-3 text-black">
          <span className="font-semibold">ผู้จ่ายเงิน</span>
          <label className="flex items-center gap-1"><CB />ออกภาษีให้ครั้งเดียว</label>
          <label className="flex items-center gap-1"><CB />ออกภาษีให้ตลอดไป</label>
          <label className="flex items-center gap-1"><CB checked />หักภาษี ณ ที่จ่าย</label>
          <label className="flex items-center gap-1"><CB />อื่น ๆ ........</label>
        </div>

        <div className="text-center text-xs mb-4 border-t border-slate-300 pt-3 text-black">
          ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความเป็นจริงทุกประการ
        </div>

        {/* ลงชื่อ */}
        <div className="text-center text-xs text-black">
          <div className="mb-1">ลงชื่อ ................................................................ ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</div>
          <div className="mb-0.5">{thaiDate}</div>
          <div className="text-slate-500">วัน ปี ที่ออกทางหนังสือรับรอง</div>
        </div>

        {/* หมายเหตุ */}
        <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-black">
          <p><span className="font-bold">หมายเหตุ *</span> ให้สามารถอ้างอิงหลักฐานยืนยันอันได้ตระหว่างที่จำเป็นตามที่กำหนดในหนังสือรับรอง ถ้าแบบนี้สร้างระหว่างที่ทำตามหนังสือรับรอง ถ้าแบบอื่นๆ นอกจากที่กรมสรรพากรกำหนด โดยอนุมัติของกรมสรรพากรก็ใช้แบบอื่นๆ แทนได้</p>
          <p className="mt-1"><span className="font-bold">คำเตือน</span> ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญา ตามมาตรา 35 แห่งประมวลรัษฎากร</p>
        </div>
      </div>
    </div>
  );
}
