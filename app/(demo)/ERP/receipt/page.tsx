"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";
import ReceiptPreview from "@/app/components/ReceiptPreview";
import ReceiptType2 from "@/app/components/ReceiptType2";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number | null;
}

interface ReceiptMeta {
  type: number;
  configName: string;
  sheetName: string;
  companySheetName: string;
  moduleName: string;
}

interface CompanyInfo {
  company_name?: string;
  company_name_en?: string;
  address?: string;
  tel?: string;
  tax_id?: string;
  logo_url?: string;
}

interface TxRow {
  rowIndex: number;
  data: any[];
}

interface ReceiptGroup {
  receiptNo: string;
  date: string;
  customerName: string;
  customerTel: string;
  rows: TxRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** pattern matching สำหรับ classify fieldName */
const matches = (name: string, patterns: string[]) =>
  patterns.some((p) => name.toLowerCase().includes(p));

function getVal(row: any[], field: ConfigField | undefined): string {
  if (!field || field.order === null || field.order === undefined) return "";
  return (row[field.order - 1] ?? "").toString().trim();
}

function findField(config: ConfigField[], ...names: string[]): ConfigField | undefined {
  return config.find((f) => names.some((n) => f.fieldName.toLowerCase() === n));
}

function findFieldLike(config: ConfigField[], ...patterns: string[]): ConfigField | undefined {
  return config.find((f) => matches(f.fieldName, patterns));
}

function fmt(v: string): string {
  const n = parseFloat(v.replace(/,/g, ""));
  if (isNaN(n)) return v;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ReceiptPage() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";
  const preSelectNo   = searchParams.get("receiptNo") || "";

  const [navOpen,   setNavOpen]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [meta,      setMeta]      = useState<ReceiptMeta | null>(null);
  const [config,    setConfig]    = useState<ConfigField[]>([]);
  const [company,   setCompany]   = useState<CompanyInfo>({});
  const [groups,    setGroups]    = useState<ReceiptGroup[]>([]);

  // search / filter
  const [search,    setSearch]    = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // preview modal
  const [preview,   setPreview]   = useState<ReceiptGroup | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Load data on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated" || !spreadsheetId) return;
    loadAll();
  }, [status, spreadsheetId]);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // 1. lookup: find receipt meta from client_receipt
      const lookupRes = await fetch(`/api/receipt/lookup?spreadsheetId=${spreadsheetId}`);
      if (!lookupRes.ok) {
        const d = await lookupRes.json().catch(() => ({}));
        throw new Error(d.error || "ไม่พบ receipt config สำหรับ spreadsheet นี้");
      }
      const metaData: ReceiptMeta = await lookupRes.json();
      setMeta(metaData);

      // 2. parallel: config + transactions + company info
      const [cfgRes, txRes, coRes] = await Promise.all([
        fetch(`/api/receipt/config?spreadsheetId=${spreadsheetId}&configName=${encodeURIComponent(metaData.configName)}`),
        fetch(`/api/receipt/transactions?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(metaData.sheetName)}`),
        fetch(`/api/receipt/company-info?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(metaData.companySheetName)}`),
      ]);

      const cfgData = cfgRes.ok ? await cfgRes.json() : { fields: [] };
      const txData  = txRes.ok  ? await txRes.json()  : { transactions: [] };
      const coData  = coRes.ok  ? await coRes.json()  : { companyInfo: {} };

      const fields: ConfigField[] = cfgData.fields || [];
      setConfig(fields);
      setCompany(coData.companyInfo || {});

      // 3. group transactions by receipt_no
      const receiptNoField = findField(fields, "receipt_no", "receipt_id", "no", "เลขที่", "receipt_number")
        ?? findFieldLike(fields, "receipt_id", "receipt_no", "receipt");
      const dateField      = findField(fields, "date", "วันที่")
        ?? findFieldLike(fields, "date", "วัน");
      const custNameField  = findField(fields, "customer_name", "ชื่อ", "name")
        ?? findFieldLike(fields, "customer", "name", "ชื่อ");
      const custTelField   = findField(fields, "customer_tel", "tel", "phone")
        ?? findFieldLike(fields, "tel", "phone", "โทร");

      const map = new Map<string, ReceiptGroup>();

      for (const tx of (txData.transactions || []) as TxRow[]) {
        const rNo  = getVal(tx.data, receiptNoField)  || `ROW${tx.rowIndex}`;
        const date = getVal(tx.data, dateField)       || "";
        const name = getVal(tx.data, custNameField)   || "";
        const tel  = getVal(tx.data, custTelField)    || "";

        if (!map.has(rNo)) {
          map.set(rNo, { receiptNo: rNo, date, customerName: name, customerTel: tel, rows: [] });
        }
        map.get(rNo)!.rows.push(tx);
      }

      const grouped = [...map.values()].reverse(); // ล่าสุดก่อน
      setGroups(grouped);

      // pre-select if URL has receiptNo
      if (preSelectNo) {
        const found = grouped.find((g) => g.receiptNo === preSelectNo);
        if (found) setPreview(found);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, preSelectNo]);

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const isType2 = meta?.type === 2;
    const pageSize = isType2 ? "210mm 165mm" : "A4";
    const bodyWidth = isType2 ? "210mm" : "210mm";
    const w = window.open("", "_blank", "width=700,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>ใบเสร็จ ${preview?.receiptNo || ""}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Sarabun',Arial,sans-serif}@page{size:${pageSize} portrait;margin:0}@media print{html,body{height:100%;width:${bodyWidth}}}</style>
      </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  // ── Build receipt props ─────────────────────────────────────────────────────
  function buildType1Props(group: ReceiptGroup) {
    const vatField   = findField(config, "vat", "ภาษี");
    const hasVAT     = !!(vatField?.order);
    const amtField   = findField(config, "amount", "total", "ยอดรวม", "total_amount")
      ?? findFieldLike(config, "amount", "total", "ยอด");
    const qtyField   = findField(config, "qty", "quantity", "จำนวน")
      ?? findFieldLike(config, "qty", "quantity", "จำนวน");
    const descField  = findField(config, "item_name", "program", "treatment", "description", "รายการ")
      ?? findFieldLike(config, "item", "program", "treat", "desc", "รายการ");
    const payField   = findField(config, "payment_method", "payment", "channel")
      ?? findFieldLike(config, "payment", "channel", "ชำระ");
    const custIdField = findField(config, "customer_id", "cust_id")
      ?? findFieldLike(config, "cust_id", "customer_id");
    const custAddrField = findFieldLike(config, "address", "ที่อยู่");

    const items = group.rows.map((tx) => {
      const rawAmt = parseFloat(getVal(tx.data, amtField).replace(/,/g, "")) || 0;
      const rawVat = hasVAT ? parseFloat(getVal(tx.data, vatField).replace(/,/g, "")) || 0 : 0;
      return {
        description:       getVal(tx.data, descField) || "รายการ",
        quantity:          parseFloat(getVal(tx.data, qtyField).replace(/,/g, "")) || 1,
        amount_before_vat: hasVAT ? rawAmt - rawVat : rawAmt,
        vat_amount:        rawVat,
        amount_after_vat:  rawAmt,
      };
    });

    const totalVat  = items.reduce((s, i) => s + i.vat_amount, 0);
    const totalAmt  = items.reduce((s, i) => s + i.amount_after_vat, 0);
    const subtotal  = totalAmt - totalVat;

    const payMethods = group.rows
      .map((tx) => {
        const m = getVal(tx.data, payField);
        const a = parseFloat(getVal(tx.data, amtField).replace(/,/g, "")) || 0;
        return m ? { method: m, amount: a } : null;
      })
      .filter(Boolean) as { method: string; amount: number }[];

    const firstRow = group.rows[0]?.data ?? [];
    return {
      hasVAT,
      companyInfo:        company,
      receiptNo:          group.receiptNo,
      date:               group.date,
      customerId:         getVal(firstRow, custIdField),
      customerName:       group.customerName,
      customerTel:        group.customerTel,
      customerAddress:    getVal(firstRow, custAddrField),
      items,
      subtotal_before_vat: subtotal,
      total_vat:           totalVat,
      total_after_vat:     totalAmt,
      paymentMethods:      payMethods.length ? payMethods : [],
    };
  }

  function buildType2Props(group: ReceiptGroup) {
    const firstRow = group.rows[0]?.data ?? [];

    // ── Field classifiers ────────────────────────────────────────────────────
    const isSkip = (f: ConfigField) =>
      f.type === "period" ||
      ["date", "status", "period", "branch"].includes(f.fieldName.toLowerCase()) ||
      matches(f.fieldName, ["receipt_id", "receipt_no", "receipt_number"]);

    const isCust = (f: ConfigField) =>
      f.fieldName.toLowerCase().startsWith("cust_") ||
      matches(f.fieldName, ["customer_name", "customer_tel", "customer_phone"]);

    const isSummary = (f: ConfigField) =>
      !isCust(f) && (
        matches(f.fieldName, ["totalprice", "total_price", "grand_total"]) ||
        f.fieldName.toLowerCase() === "deposit"
      );

    // footer = discount / after-discount / return-deadline (shown below table, not inside table)
    const isFooterDetail = (f: ConfigField) =>
      matches(f.fieldName, ["discount", "after_discount", "price_after", "return", "deadline"]);

    const isTableItem = (f: ConfigField) =>
      f.order !== null && !isSkip(f) && !isCust(f) && !isSummary(f) && !isFooterDetail(f);

    const isFooterItem = (f: ConfigField) =>
      f.order !== null && !isSkip(f) && !isCust(f) && !isSummary(f) && isFooterDetail(f);

    // ── Customer ─────────────────────────────────────────────────────────────
    const custNameField = findFieldLike(config, "cust_name") ?? findFieldLike(config, "name", "ชื่อ");
    const custTelField  = findFieldLike(config, "cust_phone") ?? findFieldLike(config, "phone", "tel", "โทร");

    const extraCustFields = config.filter(
      (f) => f.order !== null && isCust(f) && f !== custNameField && f !== custTelField
    );
    const headerFields = extraCustFields
      .map((f) => ({ label: f.label, value: getVal(firstRow, f) }))
      .filter((x) => x.value);

    // ── Table columns ─────────────────────────────────────────────────────────
    const tableFieldsSorted = config
      .filter(isTableItem)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const tableHeaders = tableFieldsSorted.map((f) => f.label);
    const tableRows    = group.rows.map((tx) =>
      tableFieldsSorted.map((f) => getVal(tx.data, f))
    );

    // ── Footer detail fields (discount, price_after, return_deadline) ─────────
    const footerFieldsSorted = config
      .filter(isFooterItem)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const footerDetails = footerFieldsSorted.map((f) => ({
      label: f.label,
      value: getVal(firstRow, f),
    }));

    // ── Summary (deposit, totalprice) ────────────────────────────────────────
    const summaryFieldsSorted = config
      .filter((f) => f.order !== null && isSummary(f))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const summaryFields = summaryFieldsSorted.map((f) => ({
      label: f.label,
      value: fmt(getVal(firstRow, f)),
    }));

    return {
      companyInfo:  company,
      receiptNo:    group.receiptNo,
      date:         group.date,
      customerName: getVal(firstRow, custNameField) || group.customerName,
      customerTel:  getVal(firstRow, custTelField)  || group.customerTel,
      headerFields,
      tableHeaders,
      tableRows,
      footerDetails,
      summaryFields,
    };
  }

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = groups.filter((g) => {
    const q = search.toLowerCase();
    if (q && !g.receiptNo.toLowerCase().includes(q) && !g.customerName.toLowerCase().includes(q)) return false;
    if (dateFilter && !g.date.includes(dateFilter)) return false;
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-violet-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-purple-600/6 blur-[100px]" />
      </div>

      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Top bar */}
      <div className="relative z-20 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
            <button onClick={() => router.push("/ERP/home-demo")}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-400 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">{meta?.moduleName || "ใบเสร็จ"}</h1>
              {meta && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  meta.type === 2
                    ? "bg-purple-500/20 text-purple-300"
                    : "bg-violet-500/20 text-violet-300"
                }`}>
                  Type {meta.type} — {meta.type === 2 ? "ร้านเช่าชุด" : "คลีนิค"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-300">ไม่สามารถโหลดข้อมูลได้</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Search + filter bar */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่ใบเสร็จ หรือชื่อลูกค้า..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <input
            type="text" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            placeholder="กรองวันที่ (เช่น 2026)"
            className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 w-44"
          />
          <button onClick={loadAll}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 rounded-xl transition-all shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            รีเฟรช
          </button>
        </div>

        {/* Receipt list */}
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-violet-500 rounded-full" />
              <h2 className="text-sm font-bold text-white">รายการ</h2>
              <span className="text-xs text-slate-500">{filtered.length} ใบ</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              {groups.length === 0 ? "ยังไม่มีข้อมูล" : "ไม่พบรายการที่ค้นหา"}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((g) => (
                <div key={g.receiptNo} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">
                        {g.customerName || g.receiptNo}
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0">{g.date}</span>
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {g.customerTel && <span className="text-slate-500">{g.customerTel}</span>}
                      {!g.receiptNo.startsWith("ROW") && (
                        <span className="ml-2 text-slate-600">{g.receiptNo}</span>
                      )}
                      <span className="ml-2 text-slate-600">{g.rows.length} รายการ</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setPreview(g)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 rounded-xl transition-all shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    พรีวิว
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Modal ─────────────────────────────────────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[240mm] relative">

            {/* Modal toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 rounded-t-2xl bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-violet-100 rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <span className="text-sm font-bold text-slate-800">ใบเสร็จ {preview.receiptNo}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  meta?.type === 2 ? "bg-purple-100 text-purple-700" : "bg-violet-100 text-violet-700"
                }`}>Type {meta?.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                  </svg>
                  พิมพ์
                </button>
                <button onClick={() => setPreview(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Receipt content */}
            <div ref={printRef}>
              {meta?.type === 2 ? (
                <ReceiptType2 {...buildType2Props(preview)} />
              ) : (
                <ReceiptPreview {...buildType1Props(preview)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiptPageWrapper() {
  return (
    <Suspense>
      <ReceiptPage />
    </Suspense>
  );
}
