"use client";

import { useEffect, useState, Suspense, useMemo, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConfigField { fieldName: string; label: string; type: string; order: number }
interface SalesMod { moduleId: string; moduleName: string; spreadsheetId: string; sheetName: string; configName: string }
interface ExpenseMod { spreadsheetId: string; sheetName: string; configName: string }

// ─── Dynamic field finder (reads config, not hardcoded) ───────────────────────
function findFieldName(
  config: ConfigField[],
  exactNames: string[],
  labelHints: string[],
  type?: string
): string | null {
  const pool = type ? config.filter((f) => (f.type ?? "").toLowerCase() === type.toLowerCase()) : config;
  for (const name of exactNames) {
    const f = pool.find((f) => f.fieldName.toLowerCase() === name.toLowerCase());
    if (f) return f.fieldName;
  }
  for (const hint of labelHints) {
    const f = pool.find((f) => f.label.toLowerCase().includes(hint.toLowerCase()));
    if (f) return f.fieldName;
  }
  // fallback: ถ้า type filter ไม่เจอ ลองหาจาก exactNames โดยไม่กรอง type (เผื่อ sheet ใช้ type ต่างกัน)
  if (type && pool.length === 0) {
    for (const name of exactNames) {
      const f = config.find((f) => f.fieldName.toLowerCase() === name.toLowerCase());
      if (f) return f.fieldName;
    }
  }
  return null;
}

function deriveFields(config: ConfigField[]) {
  return {
    period:     config.find((f) => (f.type ?? "").toLowerCase() === "period")?.fieldName || null,
    date:       config.find((f) => (f.type ?? "").toLowerCase() === "date")?.fieldName   || null,
    sales:      findFieldName(config, ["total_sales","totalprice","sales","ยอดขาย"], ["ยอดรวม","ยอดขาย","sale","total_sale","รวมทั้งหมด"], "number"),
    cost:       findFieldName(config, ["cost","ต้นทุน"], ["ต้นทุน","cost"], "number"),
    profit:     findFieldName(config, ["profit","กำไร"], ["กำไร","profit"], "number"),
    deposit:    findFieldName(config, ["deposit","มัดจำ"], ["มัดจำ","deposit"], "number"),
    custName:   findFieldName(config, ["cust_name","customer_name"], ["ชื่อลูกค้า","นามลูกค้า","ลูกค้า","customer"]),
    custChan:   findFieldName(config, ["cust_chan","channel","ช่องทาง"], ["ช่องทาง","channel","chan"]),
    custStatus: findFieldName(config, ["cust_status"], ["สถานะลูกค้า"]),
    statusAny:  findFieldName(config, ["status","cust_status"], ["สถานะ"]),
    program:    findFieldName(config, ["program","service","product","บริการ"], ["โปรแกรม","program","บริการ","service","รายการ"]),
    quantity:   findFieldName(config, ["quantity","จำนวน"], ["จำนวน","qty","quantity"]),
    branchId:   findFieldName(config, ["branch_id","branch"], ["สาขา","branch"]),
    numberFields: config.filter((f) => (f.type ?? "").toLowerCase() === "number"),
  };
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function parseNum(v: any): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function normDate(s: string): string | null {
  const v = String(s ?? "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const parts = v.split(/[\/\-\.]/);
  if (parts.length !== 3) return null;
  const [a, b, c] = parts.map(Number);
  if (c >= 1900 && c <= 2100) {
    let day: number, month: number;
    if (a > 12) { day = a; month = b; }
    else if (b > 12) { month = a; day = b; }
    else { day = a; month = b; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${c}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  if (a >= 1900) return `${a}-${String(b).padStart(2,"0")}-${String(c).padStart(2,"0")}`;
  return null;
}

function fmtDate(raw: any) {
  const n = normDate(String(raw ?? ""));
  if (!n) return String(raw ?? "-");
  const [y, m, d] = n.split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number)  { return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtFull(n: number) { return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtRaw(n: number)  { return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ─── Data generators ──────────────────────────────────────────────────────────
function genKPI(rows: any[], fields: ReturnType<typeof deriveFields>) {
  let sales = 0, cost = 0, profit = 0, deposit = 0;
  const custSet = new Set<string>();
  rows.forEach((r) => {
    if (fields.sales)   sales   += parseNum(r[fields.sales]);
    if (fields.cost)    cost    += parseNum(r[fields.cost]);
    if (fields.profit)  profit  += parseNum(r[fields.profit]);
    if (fields.deposit) deposit += parseNum(r[fields.deposit]);
    if (fields.custName) custSet.add(String(r[fields.custName] ?? "").trim());
  });
  const numKPI: Record<string, { sum: number; avg: number; max: number; count: number }> = {};
  fields.numberFields.forEach((f) => {
    const vals = rows.map((r) => parseNum(r[f.fieldName])).filter((v) => v !== 0 || rows.some((r) => r[f.fieldName] !== "" && r[f.fieldName] !== null));
    const nonZero = vals.filter((v) => v !== 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    numKPI[f.fieldName] = { sum, avg: nonZero.length ? sum / nonZero.length : 0, max: Math.max(0, ...vals), count: nonZero.length };
  });
  const newCount = fields.custStatus ? rows.filter((r) => String(r[fields.custStatus!] ?? "").includes("ใหม่")).length : 0;
  const oldCount = fields.custStatus ? rows.filter((r) => String(r[fields.custStatus!] ?? "").includes("เก่า")).length : 0;
  return { sales, cost, profit, deposit, custCount: custSet.size - (custSet.has("") ? 1 : 0), count: rows.length, numKPI, newCount, oldCount };
}

function genLineDataDynamic(rows: any[], dateField: string | null, fields: ReturnType<typeof deriveFields>) {
  if (!dateField) return [];
  const m: Record<string, any> = {};
  rows.forEach((r) => {
    const d = normDate(String(r[dateField] ?? "").trim());
    if (!d) return;
    if (!m[d]) m[d] = { date: d, ยอดขาย: 0, ต้นทุน: 0, กำไร: 0 };
    if (fields.sales)  m[d].ยอดขาย += parseNum(r[fields.sales]);
    if (fields.cost)   m[d].ต้นทุน  += parseNum(r[fields.cost]);
    if (fields.profit) m[d].กำไร   += parseNum(r[fields.profit]);
  });
  return Object.values(m).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

function genPieData(rows: any[], chanField: string | null) {
  if (!chanField) return [];
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const ch = String(r[chanField] ?? "").trim();
    if (!ch) return;
    m[ch] = (m[ch] || 0) + 1;
  });
  return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function genProgramData(rows: any[], progField: string | null, fields: ReturnType<typeof deriveFields>) {
  if (!progField) return [];
  const m: Record<string, { profit: number; sales: number }> = {};
  rows.forEach((r) => {
    const p = String(r[progField] ?? "").trim();
    if (!p) return;
    if (!m[p]) m[p] = { profit: 0, sales: 0 };
    if (fields.profit) m[p].profit += parseNum(r[fields.profit]);
    if (fields.sales)  m[p].sales  += parseNum(r[fields.sales]);
  });
  const sorted = Object.entries(m)
    .map(([name, d]) => ({ name, profit: d.profit, sales: d.sales, margin: d.sales > 0 ? (d.profit / d.sales) * 100 : 0 }))
    .sort((a, b) => (b.profit || b.sales) - (a.profit || a.sales));
  const totProfit = sorted.reduce((s, x) => s + x.profit, 0);
  const totSales  = sorted.reduce((s, x) => s + x.sales, 0);
  return [...sorted, { name: "รวมทั้งหมด", profit: totProfit, sales: totSales, margin: totSales > 0 ? (totProfit / totSales) * 100 : 0 }];
}

function genRanking(rows: any[], custNameField: string | null, fields: ReturnType<typeof deriveFields>) {
  if (!custNameField) return [];
  const m: Record<string, { count: number; sales: number; profit: number }> = {};
  rows.forEach((r) => {
    const n = String(r[custNameField] ?? "").trim();
    if (!n) return;
    if (!m[n]) m[n] = { count: 0, sales: 0, profit: 0 };
    m[n].count  += 1;
    if (fields.sales)  m[n].sales  += parseNum(r[fields.sales]);
    if (fields.profit) m[n].profit += parseNum(r[fields.profit]);
  });
  return Object.entries(m)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);
}

function genStatusBreakdown(rows: any[], statusField: string | null) {
  if (!statusField) return [] as { name: string; count: number; pct: number }[];
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const s = String(r[statusField] ?? "").trim();
    if (!s) return;
    m[s] = (m[s] || 0) + 1;
  });
  const total = Object.values(m).reduce((a, b) => a + b, 0);
  return Object.entries(m)
    .map(([name, count]) => ({ name, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

function genProductQty(rows: any[], programField: string | null, qtyField: string | null) {
  if (!programField) return [] as { name: string; count: number }[];
  const m: Record<string, number> = {};
  rows.forEach((r) => {
    const p = String(r[programField] ?? "").trim();
    if (!p) return;
    const qty = qtyField ? parseNum(r[qtyField]) || 1 : 1;
    m[p] = (m[p] || 0) + qty;
  });
  return Object.entries(m)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function getAvailDates(rows: any[], config: ConfigField[], period: string): string[] {
  const pf = config.find((f) => f.type === "period");
  const df = config.find((f) => f.type === "date");
  if (!pf || !df || !period) return [];
  return Array.from(new Set(
    rows
      .filter((r) => String(r[pf.fieldName] ?? "").trim() === period)
      .map((r) => normDate(String(r[df.fieldName] ?? "").trim()))
      .filter((d): d is string => !!d)
  )).sort();
}

// ─── Tooltip style ────────────────────────────────────────────────────────────
const TT = { backgroundColor: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, color: "#f1f5f9", fontSize: 12, padding: "8px 12px" };
const CHAN_COLORS = ["#6366f1","#ec4899","#34d399","#f59e0b","#60a5fa","#f87171","#a78bfa","#2dd4bf","#fb923c","#e879f9"];

// ─── Sub-components ───────────────────────────────────────────────────────────
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-red-500/60" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
        <div className="w-2 h-2 rounded-full bg-green-500/60" />
      </div>
      <span className="text-xs font-semibold text-slate-400 flex-1">{title}</span>
      {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">{badge}</span>}
    </div>
  );
}

function KPITile({ label, value, sub, subLabel, accent, icon }: {
  label: string; value: string; sub: string; subLabel: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 flex flex-col gap-2.5"
      style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 24px ${accent}14` }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}22`, border: `1px solid ${accent}40` }}>{icon}</div>
      </div>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: `${accent}cc` }}>{label}</p>
        <p className="text-xl font-bold text-white leading-none">{value}</p>
      </div>
      <div className="border-t border-white/[0.06] pt-2 flex justify-between text-[11px]">
        <span className="text-slate-500">{subLabel}</span>
        <span className="font-semibold" style={{ color: accent }}>{sub}</span>
      </div>
    </div>
  );
}

// Customer modal
function CustModal({ name, rows, fields, onClose }: {
  name: string; rows: any[]; fields: ReturnType<typeof deriveFields>; onClose: () => void;
}) {
  const sorted = [...rows].sort((a, b) => {
    const da = normDate(String(a[fields.date ?? "date"] ?? "")) || "";
    const db = normDate(String(b[fields.date ?? "date"] ?? "")) || "";
    return db.localeCompare(da);
  });
  const total  = sorted.reduce((s, r) => s + (fields.sales  ? parseNum(r[fields.sales])  : 0), 0);
  const profit = sorted.reduce((s, r) => s + (fields.profit ? parseNum(r[fields.profit]) : 0), 0);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-5 py-4 flex items-start justify-between border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">{name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{sorted.length} รายการ</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-px bg-white/[0.05] border-b border-white/[0.07]">
          {[{ l: "ยอดรวม", v: fmtFull(total), c: "#ec4899" },{ l: "กำไรรวม", v: fmtFull(profit), c: "#34d399" },{ l: "ครั้ง", v: `${sorted.length}`, c: "#a78bfa" }]
            .map(({ l, v, c }) => (
              <div key={l} className="px-4 py-3 bg-white/[0.02]">
                <p className="text-[10px] text-slate-500">{l}</p>
                <p className="text-sm font-bold" style={{ color: c }}>{v}</p>
              </div>
            ))}
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {sorted.map((txn, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>{i + 1}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{fields.program ? String(txn[fields.program] ?? "-") : "-"}</p>
                  <p className="text-[11px] text-slate-500">{fields.date ? fmtDate(txn[fields.date]) : "-"}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-sm font-semibold text-white">{fields.sales ? fmtFull(parseNum(txn[fields.sales])) : "-"}</p>
                {fields.profit && <p className="text-[11px]" style={{ color: "#34d399" }}>{fmtFull(parseNum(txn[fields.profit]))}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
function SalesDashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const sp     = useSearchParams();
  const initSid    = sp.get("spreadsheetId") || "";
  const initConfig = sp.get("configName")    || "";
  const initSheet  = sp.get("sheetName")     || "";

  const [navOpen,       setNavOpen]       = useState(false);
  const [isSA,          setIsSA]          = useState(false);
  const [userBranchId,   setUserBranchId]   = useState<string | null>(null);
  const [userBranchName, setUserBranchName] = useState<string | null>(null);
  const [salesMods,     setSalesMods]     = useState<SalesMod[]>([]);
  const [expenseMod,    setExpenseMod]    = useState<ExpenseMod | null>(null);
  const [clientType,    setClientType]    = useState<number>(1);
  const [selectedMod,   setSelectedMod]   = useState<SalesMod | null>(null);
  const [clientName,    setClientName]    = useState("");
  const [authLoading,   setAuthLoading]   = useState(true);

  const [config,      setConfig]      = useState<ConfigField[]>([]);
  const [allData,     setAllData]     = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError,   setDataError]   = useState<string | null>(null);

  // filters
  const [selPeriods,   setSelPeriods]  = useState<string[]>([]);
  const [selDate,      setSelDate]     = useState("");
  const [selBranch,    setSelBranch]   = useState("");
  const [showPdDrop,   setShowPdDrop]  = useState(false);

  // viz
  const [filteredData,  setFilteredData]  = useState<any[]>([]);
  const [kpi,           setKpi]           = useState<ReturnType<typeof genKPI> | null>(null);
  const [lineData,      setLineData]      = useState<any[]>([]);
  const [pieData,       setPieData]       = useState<any[]>([]);
  const [progData,      setProgData]      = useState<any[]>([]);
  const [rankData,      setRankData]      = useState<any[]>([]);
  const [statusData,    setStatusData]    = useState<{ name: string; count: number; pct: number }[]>([]);
  const [productQtyData,setProductQtyData]= useState<{ name: string; count: number }[]>([]);
  const [expenseByPeriod, setExpenseByPeriod] = useState<Record<string, number>>({});

  // UI
  const [showProgDetail, setShowProgDetail] = useState(false);
  const [showTxn,        setShowTxn]        = useState(false);
  const [showTop10,      setShowTop10]      = useState(false);
  const [selCust,        setSelCust]        = useState<string | null>(null);
  const [mounted,        setMounted]        = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  // load modules
  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch("/api/auth/branch-check").then((r) => r.json()),
      fetch("/api/user/modules-demo").then((r) => r.json()),
    ]).then(([auth, mods]) => {
      const sa = (auth.role || "").toUpperCase() === "SUPER_ADMIN";
      setIsSA(sa);
      setUserBranchId(sa ? null : (auth.branchId || null));
      setUserBranchName(sa ? null : (auth.branchName || null));
      setClientName(mods.clientName || "");
      setClientType(mods.clientType || 1);
      // อ่านจาก client_dashboard (dashboardItems) — กรองเฉพาะ Sales
      const all: SalesMod[] = (mods.dashboardItems || [])
        .map((m: any) => ({
          moduleId:      m.dashboardId,
          moduleName:    m.dashboardName,
          spreadsheetId: m.spreadsheetId,
          sheetName:     m.sheetName,
          configName:    m.dashboardConfigName,
        }));
      setSalesMods(all);

      // หา expense module จาก client_modules
      const expMod = (mods.modules || []).find((m: any) => {
        const n = (m.moduleName || "").toLowerCase();
        return n.includes("expense") || n.includes("ค่าใช้จ่าย") || n.includes("cost");
      });
      if (expMod) {
        setExpenseMod({
          spreadsheetId: expMod.spreadsheetId,
          sheetName:     expMod.sheetName,
          configName:    expMod.configName,
        });
      }

      const def =
        (initSid && initConfig && initSheet)
          ? (all.find((m) => m.spreadsheetId === initSid) ||
             { moduleId: "url", moduleName: sp.get("moduleName") || "Sales", spreadsheetId: initSid, configName: initConfig, sheetName: initSheet })
          : all.find((m) => m.spreadsheetId === initSid) || all[0] || null;
      setSelectedMod(def);
    }).finally(() => setAuthLoading(false));
  }, [session]);

  // load data
  useEffect(() => {
    if (!selectedMod || !session) return;
    setDataLoading(true);
    setDataError(null);
    setAllData([]); setConfig([]); setSelPeriods([]); setSelDate(""); setSelBranch("");
    const p = new URLSearchParams({ spreadsheetId: selectedMod.spreadsheetId, configName: selectedMod.configName, sheetName: selectedMod.sheetName });
    if (expenseMod) {
      p.set("expenseSpreadsheetId", expenseMod.spreadsheetId);
      p.set("expenseSheetName",     expenseMod.sheetName);
      p.set("expenseConfigName",    expenseMod.configName);
    }
    fetch(`/api/sales-dashboard-demo?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setConfig(d.config || []);
        setAllData(d.rows  || []);
        setExpenseByPeriod(d.expenseByPeriod || {});
      })
      .catch((e) => { setDataError(e.message); })
      .finally(() => setDataLoading(false));
  }, [selectedMod?.moduleId, selectedMod?.spreadsheetId, session]);

  // derive fields from config
  const fields = useMemo(() => deriveFields(config), [config]);

  // period options
  const periodOptions = useMemo(() => {
    if (!fields.period) return [];
    return Array.from(new Set(allData.map((r) => String(r[fields.period!] ?? "").trim()).filter(Boolean))).sort();
  }, [allData, fields.period]);

  // date options (when 1 period selected)
  const availDates  = useMemo(() => selPeriods.length === 1 ? getAvailDates(allData, config, selPeriods[0]) : [], [allData, config, selPeriods]);
  const canSelDate  = selPeriods.length === 1 && availDates.length > 0;

  // branch options (SA only — unique branch values from data)
  const branchOptions = useMemo(() => {
    if (!isSA || !fields.branchId) return [];
    return Array.from(new Set(allData.map((r) => String(r[fields.branchId!] ?? "").trim()).filter(Boolean))).sort();
  }, [allData, fields.branchId, isSA]);

  // apply filters + build viz
  const applyFilters = useCallback((
    rows: any[], periods: string[], date: string, branch: string, cfg: ConfigField[], sa: boolean, ubid: string | null, ubname: string | null
  ) => {
    const f = deriveFields(cfg);
    let out = rows;
    // branch filter: SA เลือกเอง, non-SA ถูก lock ตาม branchId/branchName
    const effectiveBranch = sa ? branch : (ubid || "");
    if (effectiveBranch && f.branchId) {
      const eb   = effectiveBranch.toLowerCase();
      const ebN  = (ubname || "").toLowerCase(); // also try branchName
      out = out.filter((r) => {
        const val = String(r[f.branchId!] ?? "").trim().toLowerCase();
        return val === eb || (ebN && val === ebN);
      });
    }
    if (periods.length > 0 && f.period) {
      out = out.filter((r) => periods.includes(String(r[f.period!] ?? "").trim()));
    }
    if (date && f.date) {
      const nd = normDate(date);
      out = out.filter((r) => normDate(String(r[f.date!] ?? "").trim()) === nd);
    }
    setFilteredData(out);
    setKpi(genKPI(out, f));
    setLineData(genLineDataDynamic(out, f.date, f));
    setPieData(genPieData(out, f.custChan ?? f.statusAny));
    setProgData(genProgramData(out, f.program, f));
    setRankData(genRanking(out, f.custName, f));
    setStatusData(genStatusBreakdown(out, f.statusAny));
    setProductQtyData(genProductQty(out, f.program, f.quantity));
  }, []);

  useEffect(() => {
    if (allData.length > 0 && config.length > 0)
      applyFilters(allData, selPeriods, selDate, selBranch, config, isSA, userBranchId, userBranchName);
  }, [selPeriods, selDate, selBranch, allData, config, isSA, userBranchId, userBranchName, applyFilters]);

  useEffect(() => { setSelDate(""); }, [selPeriods]);

  // customer transactions
  const custTxns = useMemo(() => selCust && fields.custName ? allData.filter((r) => String(r[fields.custName!] ?? "").trim() === selCust) : [], [selCust, allData, fields.custName]);

  // handlers
  const togglePeriod  = (p: string) => setSelPeriods((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const toggleAll     = () => setSelPeriods((prev) => prev.length === periodOptions.length ? [] : [...periodOptions]);
  const clearFilters  = () => { setSelPeriods([]); setSelDate(""); setSelBranch(""); };

  const isRental     = clientType === 2;
  const wfDisplay    = showTop10 ? progData.slice(0, 10) : progData.slice(0, -1);
  const wfTotal      = progData[progData.length - 1];
  const barKey: "profit" | "sales" = fields.profit ? "profit" : "sales";
  const wfChartTitle = fields.profit ? "กำไรแยกตามรายการ / โปรแกรม" : "ยอดขายแยกตามรายการ / โปรแกรม";

  // rental P&L — expense aggregated ตาม period ที่เลือก
  const totalExpense = useMemo(() => {
    if (!isRental || !Object.keys(expenseByPeriod).length) return 0;
    if (selPeriods.length === 0) return Object.values(expenseByPeriod).reduce((s, v) => s + v, 0);
    return selPeriods.reduce((s, p) => s + (expenseByPeriod[p] || 0), 0);
  }, [isRental, expenseByPeriod, selPeriods]);

  const rentalNetProfit = (kpi?.sales ?? 0) - totalExpense;

  // เพิ่ม expense + netProfit เข้า lineData สำหรับ rental
  const rentalLineData = useMemo(() => {
    if (!isRental) return lineData;
    return lineData.map((d) => ({
      ...d,
      ค่าใช้จ่าย: expenseByPeriod[d.date] || 0,
      กำไรสุทธิ: (d.ยอดขาย || 0) - (expenseByPeriod[d.date] || 0),
    }));
  }, [isRental, lineData, expenseByPeriod]);

  if (status === "loading" || authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#080e1c]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
        </div>
        <p className="text-slate-500 text-sm tracking-widest uppercase animate-pulse">Loading</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080e1c] relative">

      {/* Ambient bg */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-indigo-700/12 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[350px] h-[350px] rounded-full bg-violet-700/10 blur-[100px]" />
        <div className="absolute -bottom-20 left-1/3 w-[300px] h-[300px] rounded-full bg-pink-700/8 blur-[100px]" />
      </div>

      {/* Quick Nav Demo */}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] backdrop-blur-xl bg-[#080e1c]/80">
        <div className="flex items-center gap-3">
          <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-slate-400 hover:text-white text-xs font-medium transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            กลับ
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
            <Image src="/logo2.png" alt="" width={28} height={28} className="object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">Sales Dashboard</span>
            {clientName && <span className="text-slate-600 text-xs hidden sm:inline">· {clientName}</span>}
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[9px] font-bold">
              <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />LIVE
            </span>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-slate-400 hover:text-white text-xs transition-all">
          {session?.user?.image && <img src={session.user.image} className="w-5 h-5 rounded-full" alt="" />}
          <span className="hidden sm:inline">{session?.user?.name?.split(" ")[0]}</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      </header>

      {/* ── Module selector (แสดงถ้ามีมากกว่า 1 module) ─────────────────── */}
      {salesMods.length > 1 && (
        <div className="relative z-20 border-b border-white/[0.05] bg-[#080e1c]/60 backdrop-blur-xl">
          <div className="max-w-screen-xl mx-auto px-5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="text-slate-600 text-[9px] font-bold uppercase tracking-widest flex-shrink-0 mr-1">Module</span>
            {salesMods.map((mod) => (
              <button key={mod.moduleId} onClick={() => setSelectedMod(mod)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedMod?.moduleId === mod.moduleId
                    ? "bg-indigo-500/25 border border-indigo-500/50 text-indigo-300"
                    : "bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.07]"
                }`}>{mod.moduleName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-5 py-6 space-y-5">

        {/* ── Filters (copied from production SalesFilters) ───────────────── */}
        {periodOptions.length > 0 && (
          <GlassCard>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-slate-400">ตัวกรองข้อมูล</p>
                {!isSA && userBranchId && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    สาขา: {userBranchId}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 items-end">

                {/* Period multi-select */}
                <div>
                  <p className="text-[10px] font-medium text-slate-500 mb-1.5">ช่วงเวลา</p>
                  <div className="relative">
                    <button
                      onClick={() => setShowPdDrop((v) => !v)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold min-w-[150px] justify-between transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <span className="text-slate-300">
                        {selPeriods.length === 0 ? "เลือกช่วงเวลา"
                          : selPeriods.length === periodOptions.length ? "ทั้งหมด"
                          : selPeriods.length === 1 ? selPeriods[0]
                          : `${selPeriods.length} ช่วง`}
                      </span>
                      <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showPdDrop ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showPdDrop && (
                      <>
                        <div className="absolute z-50 mt-1.5 w-52 rounded-xl overflow-hidden shadow-2xl"
                          style={{ background: "#0d1628", border: "1px solid rgba(255,255,255,0.12)" }}>
                          {/* Select all */}
                          <label className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.07] cursor-pointer hover:bg-white/[0.05]">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-500" style={{ accentColor: "#6366f1" }}
                              checked={selPeriods.length === periodOptions.length && periodOptions.length > 0}
                              onChange={toggleAll} />
                            <span className="text-[11px] font-bold text-slate-300">เลือกทั้งหมด ({periodOptions.length})</span>
                          </label>
                          <div className="max-h-48 overflow-y-auto">
                            {periodOptions.map((p) => (
                              <label key={p} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/[0.05] border-b border-white/[0.04] last:border-0 transition-colors">
                                <input type="checkbox" className="w-3.5 h-3.5" style={{ accentColor: "#6366f1" }}
                                  checked={selPeriods.includes(p)} onChange={() => togglePeriod(p)} />
                                <span className="text-xs text-slate-300 font-medium">{p}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="fixed inset-0 z-40" onClick={() => setShowPdDrop(false)} />
                      </>
                    )}
                  </div>
                </div>

                {/* Branch select — SA only */}
                {isSA && branchOptions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 mb-1.5">สาขา</p>
                    <select value={selBranch} onChange={(e) => setSelBranch(e.target.value)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", colorScheme: "dark", minWidth: 150 }}>
                      <option value="">ทุกสาขา ({branchOptions.length})</option>
                      {branchOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date select */}
                <div>
                  <p className="text-[10px] font-medium text-slate-500 mb-1.5">
                    วันที่
                    {selPeriods.length !== 1 && <span className="text-slate-600 ml-1">(เลือก 1 ช่วง)</span>}
                  </p>
                  <select value={selDate} onChange={(e) => setSelDate(e.target.value)} disabled={!canSelDate}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", colorScheme: "dark", minWidth: 150 }}>
                    <option value="">ทุกวัน {canSelDate ? `(${availDates.length} วัน)` : ""}</option>
                    {availDates.map((d) => {
                      const [y, m, dd] = d.split("-");
                      return <option key={d} value={d}>{`${dd}/${m}/${y}`}</option>;
                    })}
                  </select>
                </div>

                {/* Clear */}
                {(selPeriods.length > 0 || selDate || selBranch) && (
                  <div className="flex gap-2">
                    {(selPeriods.length > 0 || selDate || selBranch) && (
                      <button onClick={() => { setSelPeriods([]); setSelDate(""); }}
                        className="px-3 py-2 rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        ล้างตัวกรอง
                      </button>
                    )}
                  </div>
                )}

                {/* Count */}
                {(selPeriods.length > 0 || selBranch || (!isSA && userBranchId)) && (
                  <span className="text-[11px] font-semibold text-indigo-400 ml-1">
                    {filteredData.length.toLocaleString()} / {allData.length.toLocaleString()} รายการ
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* ── No module configured ────────────────────────────────────────── */}
        {!authLoading && !selectedMod && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <svg className="w-8 h-8 text-red-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400 font-semibold">ไม่พบ Module ที่มี Config</p>
            <p className="text-slate-600 text-sm mt-1">กรุณาตั้งค่า configName ใน client_modules ก่อน</p>
          </div>
        )}

        {/* ── Loading / Error ─────────────────────────────────────────────── */}
        {dataLoading && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
              </div>
              <p className="text-slate-500 text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        )}

        {dataError && !dataLoading && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{dataError}</p>
          </div>
        )}

        {!dataLoading && !dataError && allData.length > 0 && kpi && (
          <>
            {/* ── KPI row ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {fields.sales && (
                <KPITile label={config.find((f) => f.fieldName === fields.sales)?.label || "ยอดรวม"}
                  value={fmtNum(kpi.sales)} sub={kpi.count > 0 ? fmtNum(kpi.sales / kpi.count) : "—"} subLabel="เฉลี่ย/ครั้ง"
                  accent="#ec4899"
                  icon={<svg className="w-4.5 h-4.5" style={{ color: "#ec4899" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
              )}
              {/* Rental: expense + net profit — Clinic: cost + profit */}
              {isRental ? (
                <>
                  <KPITile label="ค่าใช้จ่าย"
                    value={fmtNum(totalExpense)}
                    sub={kpi.sales > 0 ? `${((totalExpense / kpi.sales) * 100).toFixed(1)}%` : "—"} subLabel="% รายได้"
                    accent="#f87171"
                    icon={<svg className="w-4.5 h-4.5" style={{ color: "#f87171" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                  />
                  <KPITile label="กำไรสุทธิ"
                    value={fmtNum(rentalNetProfit)}
                    sub={kpi.sales > 0 ? `${((rentalNetProfit / kpi.sales) * 100).toFixed(1)}%` : "—"} subLabel="Net Margin"
                    accent={rentalNetProfit >= 0 ? "#34d399" : "#f87171"}
                    icon={<svg className="w-4.5 h-4.5" style={{ color: rentalNetProfit >= 0 ? "#34d399" : "#f87171" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  />
                </>
              ) : (
                <>
                  {fields.cost && (
                    <KPITile label={config.find((f) => f.fieldName === fields.cost)?.label || "ต้นทุน"}
                      value={fmtNum(kpi.cost)} sub={kpi.sales > 0 ? `${((kpi.cost / kpi.sales) * 100).toFixed(1)}%` : "—"} subLabel="% ยอดขาย"
                      accent="#f87171"
                      icon={<svg className="w-4.5 h-4.5" style={{ color: "#f87171" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                    />
                  )}
                  {fields.profit && (
                    <KPITile label={config.find((f) => f.fieldName === fields.profit)?.label || "กำไร"}
                      value={fmtNum(kpi.profit)} sub={kpi.sales > 0 ? `${((kpi.profit / kpi.sales) * 100).toFixed(1)}%` : "—"} subLabel="Margin"
                      accent="#34d399"
                      icon={<svg className="w-4.5 h-4.5" style={{ color: "#34d399" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                    />
                  )}
                </>
              )}
              {/* Rental: rental count + customer count — Clinic: new/old breakdown */}
              {fields.custStatus ? (
                <KPITile label="ลูกค้าที่ใช้บริการ"
                  value={(kpi.newCount + kpi.oldCount).toLocaleString()}
                  sub={kpi.newCount + kpi.oldCount > 0 ? `${((kpi.newCount / (kpi.newCount + kpi.oldCount)) * 100).toFixed(1)}%` : "—"}
                  subLabel="สัดส่วนใหม่"
                  accent="#a78bfa"
                  icon={<svg className="w-4.5 h-4.5" style={{ color: "#a78bfa" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                />
              ) : (
                <KPITile
                  label={isRental ? "จำนวนการเช่า" : "รายการ"}
                  value={kpi.count.toLocaleString()}
                  sub={kpi.custCount > 0 ? `${kpi.custCount} คน` : "—"}
                  subLabel="ลูกค้าทั้งหมด"
                  accent="#fbbf24"
                  icon={<svg className="w-4.5 h-4.5" style={{ color: "#fbbf24" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                />
              )}
            </div>

            {/* ── 2-column grid: charts ────────────────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-5">

              {/* LEFT column */}
              <div className="space-y-5">

                {/* Line chart */}
                {(isRental ? rentalLineData : lineData).length > 0 && (
                  <GlassCard>
                    <CardHeader title={isRental ? "รายได้ vs ค่าใช้จ่าย" : "แนวโน้มยอดขาย"} badge={selPeriods.length === 1 ? selPeriods[0] : "ทั้งหมด"} />
                    <div className="p-5">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={isRental ? rentalLineData : lineData} margin={{ top: 5, right: 5, left: 0, bottom: 35 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
                            angle={-35} textAnchor="end" height={50} interval="preserveStartEnd" />
                          <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false}
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} width={45} />
                          <Tooltip contentStyle={TT} formatter={(v: any, n) => [`฿${Number(v).toLocaleString("th-TH")}`, n]} />
                          {isRental ? (
                            <>
                              <Line type="monotone" dataKey="ยอดขาย"    name="รายได้"      stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1", stroke: "#080e1c", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                              <Line type="monotone" dataKey="ค่าใช้จ่าย" name="ค่าใช้จ่าย"  stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: "#f87171", stroke: "#080e1c", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                              <Line type="monotone" dataKey="กำไรสุทธิ"  name="กำไรสุทธิ"  stroke="#34d399" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3, fill: "#34d399", stroke: "#080e1c", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                            </>
                          ) : (
                            ([
                              { key: "ยอดขาย", color: "#6366f1", show: !!fields.sales },
                              { key: "ต้นทุน",  color: "#f87171", show: !!fields.cost },
                              { key: "กำไร",   color: "#34d399", show: !!fields.profit },
                            ] as const).filter((l) => l.show).map(({ key, color }) => (
                              <Line key={key} type="monotone" dataKey={key} name={key} stroke={color} strokeWidth={2.5}
                                dot={{ r: 3, fill: color, stroke: "#080e1c", strokeWidth: 2 }}
                                activeDot={{ r: 5, fill: color, stroke: "#080e1c", strokeWidth: 2 }} />
                            ))
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                      {/* summary */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                        {isRental ? (
                          [
                            { l: "รายได้",     c: "#6366f1", v: kpi.sales },
                            { l: "ค่าใช้จ่าย", c: "#f87171", v: totalExpense },
                            { l: "กำไรสุทธิ",  c: "#34d399", v: rentalNetProfit },
                          ].map(({ l, c, v }) => (
                            <div key={l} className="text-center">
                              <div className="text-[10px] mb-1" style={{ color: c }}>{l}</div>
                              <div className="text-sm font-bold text-white">{fmtNum(v)}</div>
                            </div>
                          ))
                        ) : (
                          [
                            { l: "ยอดขาย", c: "#6366f1", v: kpi.sales,  show: !!fields.sales },
                            { l: "ต้นทุน",  c: "#f87171", v: kpi.cost,   show: !!fields.cost },
                            { l: "กำไร",   c: "#34d399", v: kpi.profit, show: !!fields.profit },
                          ].filter((x) => x.show).map(({ l, c, v }) => (
                            <div key={l} className="text-center p-2 rounded-xl" style={{ background: `${c}12` }}>
                              <p className="text-[9px] text-slate-500 mb-0.5">{l}</p>
                              <p className="text-xs font-bold" style={{ color: c }}>{fmtNum(v)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* Waterfall: profit by program */}
                {progData.length > 1 && (
                  <GlassCard>
                    <CardHeader title={wfChartTitle} badge={`${progData.length - 1} รายการ`} />
                    <div className="p-5">
                      <div className="flex justify-end mb-3">
                        {progData.length > 11 && (
                          <button onClick={() => setShowTop10((v) => !v)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${showTop10 ? "bg-indigo-500/25 border border-indigo-500/40 text-indigo-300" : "bg-white/[0.04] border border-white/[0.08] text-slate-400"}`}>
                            {showTop10 ? "Top 10" : "ทั้งหมด"}
                          </button>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={Math.max(200, wfDisplay.length * 28)}>
                        <BarChart data={wfDisplay} layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickLine={false}
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={105} />
                          <Tooltip contentStyle={TT}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              const bv: number = d[barKey] ?? 0;
                              return (
                                <div style={{ ...TT, minWidth: 150 }}>
                                  <p className="font-bold text-white text-[11px] mb-1 truncate max-w-[180px]">{d.name}</p>
                                  <p className="text-[11px]">{fields.profit ? "กำไร" : "ยอดขาย"}: <span style={{ color: bv >= 0 ? "#34d399" : "#f87171" }}>฿{fmtRaw(bv)}</span></p>
                                  {fields.profit && <p className="text-[11px]">ยอดขาย: <span className="text-slate-300">฿{fmtRaw(d.sales)}</span></p>}
                                  {fields.profit && <p className="text-[11px]">Margin: <span className="text-indigo-400">{d.margin.toFixed(1)}%</span></p>}
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey={barKey} radius={[0, 4, 4, 0]}>
                            {wfDisplay.map((d, i) => <Cell key={i} fill={(d[barKey] ?? 0) >= 0 ? "#34d399" : "#f87171"} fillOpacity={0.85} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      {wfTotal && (
                        <div className={`grid gap-2 mt-4 pt-4 border-t border-white/[0.06] ${fields.profit ? "grid-cols-2" : "grid-cols-1"}`}>
                          <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-indigo-500/10">
                            <span className="text-[10px] text-slate-400">{fields.profit ? "กำไรรวม" : "ยอดขายรวม"}</span>
                            <span className="text-xs font-bold text-indigo-300">{fmtFull(wfTotal[barKey] ?? 0)}</span>
                          </div>
                          {fields.profit && (
                            <div className="flex justify-between items-center px-3 py-2 rounded-xl bg-emerald-500/10">
                              <span className="text-[10px] text-slate-400">% กำไร</span>
                              <span className="text-xs font-bold text-emerald-400">{wfTotal.margin.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* detail table toggle */}
                      <div className="mt-3">
                        <button onClick={() => setShowProgDetail((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-2 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          รายละเอียดแยกแต่ละรายการ
                          <svg className={`w-3.5 h-3.5 transition-transform ${showProgDetail ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showProgDetail && (
                          <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr style={{ background: "rgba(255,255,255,0.03)" }} className="border-b border-white/[0.06]">
                                  {(fields.profit ? ["รายการ","ยอดขาย","กำไร","Margin"] : ["รายการ","ยอดขาย"]).map((h, i) => (
                                    <th key={h} className={`px-3 py-2.5 font-bold text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {progData.slice(0, -1).map((d, i) => (
                                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                                    <td className="px-3 py-2 font-medium text-slate-300 truncate max-w-[160px]">{d.name}</td>
                                    <td className="px-3 py-2 text-right text-slate-400">{fmtFull(d.sales)}</td>
                                    {fields.profit && <td className="px-3 py-2 text-right font-semibold" style={{ color: d.profit >= 0 ? "#34d399" : "#f87171" }}>{fmtFull(d.profit)}</td>}
                                    {fields.profit && (
                                      <td className="px-3 py-2 text-right">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${d.margin >= 30 ? "bg-emerald-500/15 text-emerald-400" : d.margin >= 15 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"}`}>
                                          {d.margin.toFixed(1)}%
                                        </span>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {wfTotal && (
                                  <tr className="border-t-2 border-indigo-500/20" style={{ background: "rgba(99,102,241,0.07)" }}>
                                    <td className="px-3 py-2.5 font-bold text-indigo-300">รวมทั้งหมด</td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-300">{fmtFull(wfTotal.sales)}</td>
                                    {fields.profit && <td className="px-3 py-2.5 text-right font-bold text-indigo-300">{fmtFull(wfTotal.profit)}</td>}
                                    {fields.profit && (
                                      <td className="px-3 py-2.5 text-right">
                                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400">{wfTotal.margin.toFixed(1)}%</span>
                                      </td>
                                    )}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                )}
              </div>

              {/* RIGHT column */}
              <div className="space-y-5">

                {/* Rental: Status distribution bars */}
                {isRental && statusData.length > 0 && (
                  <GlassCard>
                    <CardHeader title="สถานะการเช่า" badge={`${filteredData.length} รายการ`} />
                    <div className="p-5 space-y-3">
                      {statusData.map((s, i) => {
                        const STATUS_COLORS = ["#34d399","#60a5fa","#f59e0b","#f87171","#a78bfa","#2dd4bf","#fb923c","#e879f9"];
                        const col = STATUS_COLORS[i % STATUS_COLORS.length];
                        return (
                          <div key={s.name}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                                <span className="text-sm font-semibold text-slate-200">{s.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold" style={{ color: col }}>{s.count.toLocaleString()}</span>
                                <span className="text-[10px] text-slate-600 w-10 text-right">{s.pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${s.pct}%`, background: `linear-gradient(90deg, ${col}, ${col}99)` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}

                {/* Rental: Top items by quantity */}
                {isRental && productQtyData.length > 0 && (
                  <GlassCard>
                    <CardHeader
                      title={`${config.find(f => f.fieldName === fields.program)?.label || "รายการ"}ยอดนิยม`}
                      badge="จำนวนครั้ง"
                    />
                    <div className="p-5 space-y-2">
                      {productQtyData.map((item, i) => {
                        const maxCount = productQtyData[0]?.count || 1;
                        const pct = (item.count / maxCount) * 100;
                        const ITEM_COLORS = ["#6366f1","#a78bfa","#60a5fa","#34d399","#f59e0b","#ec4899","#2dd4bf","#fb923c"];
                        const col = ITEM_COLORS[i % ITEM_COLORS.length];
                        return (
                          <div key={item.name} className="flex items-center gap-3">
                            <span className="w-5 text-center text-[11px] font-bold flex-shrink-0" style={{ color: "#475569" }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between text-[12px] mb-1">
                                <span className="text-slate-300 font-medium truncate">{item.name}</span>
                                <span className="font-bold flex-shrink-0 ml-2" style={{ color: col }}>{item.count.toLocaleString()}</span>
                              </div>
                              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                )}

                {/* Clinic / generic: Pie chart */}
                {!isRental && pieData.length > 0 && (
                  <GlassCard>
                    <CardHeader
                      title={`${config.find(f => f.fieldName === (fields.custChan ?? fields.statusAny))?.label ?? "หมวดหมู่"}ยอดนิยม`}
                      badge={`${pieData.length} หมวด`}
                    />
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70}
                                dataKey="value" paddingAngle={0} strokeWidth={0}>
                                {pieData.map((_, i) => <Cell key={i} fill={CHAN_COLORS[i % CHAN_COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={TT} formatter={(v: any) => [`${Number(v).toLocaleString()} ครั้ง`, "จำนวน"]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          {[...pieData].sort((a, b) => b.value - a.value).map((d, i) => {
                            const total = pieData.reduce((s, x) => s + x.value, 0);
                            const pct = ((d.value / total) * 100).toFixed(1);
                            return (
                              <div key={d.name} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHAN_COLORS[i % CHAN_COLORS.length] }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between text-[11px] mb-0.5">
                                    <span className="text-slate-300 font-medium truncate">{d.name}</span>
                                    <span className="text-slate-500 flex-shrink-0 ml-1">{pct}%</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(d.value / pieData[0].value) * 100}%`, background: CHAN_COLORS[i % CHAN_COLORS.length] }} />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-600 flex-shrink-0">{d.value.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* Rental: generic pie as fallback when no status bars */}
                {isRental && statusData.length === 0 && pieData.length > 0 && (
                  <GlassCard>
                    <CardHeader
                      title={`${config.find(f => f.fieldName === (fields.custChan ?? fields.statusAny))?.label ?? "หมวดหมู่"}ยอดนิยม`}
                      badge={`${pieData.length} หมวด`}
                    />
                    <div className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0" style={{ width: 160, height: 160 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value" paddingAngle={0} strokeWidth={0}>
                                {pieData.map((_, i) => <Cell key={i} fill={CHAN_COLORS[i % CHAN_COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={TT} formatter={(v: any) => [`${Number(v).toLocaleString()} ครั้ง`, "จำนวน"]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          {pieData.map((d, i) => {
                            const total = pieData.reduce((s, x) => s + x.value, 0);
                            const pct = ((d.value / total) * 100).toFixed(1);
                            return (
                              <div key={d.name} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHAN_COLORS[i % CHAN_COLORS.length] }} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between text-[11px] mb-0.5">
                                    <span className="text-slate-300 font-medium truncate">{d.name}</span>
                                    <span className="text-slate-500 flex-shrink-0 ml-1">{pct}%</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(d.value / pieData[0].value) * 100}%`, background: CHAN_COLORS[i % CHAN_COLORS.length] }} />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-600 flex-shrink-0">{d.value.toLocaleString()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )}

                {/* Customer leaderboard */}
                {rankData.length > 0 && (
                  <GlassCard>
                    <CardHeader title="🏆 Customers Leaderboard" badge="คลิกเพื่อดูรายการ" />
                    <div className="p-5">
                      <div className="space-y-1">
                        {rankData.map((r, i) => (
                          <div key={r.name} onClick={() => setSelCust(r.name)}
                            className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-white/[0.05] active:scale-[0.99] transition-all group">
                            <span className="w-6 text-center text-base flex-shrink-0">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-xs font-bold text-slate-600">{i + 1}</span>}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 truncate underline decoration-dotted underline-offset-2">{r.name}</p>
                              <p className="text-[10px] text-slate-600">{r.count} ครั้ง</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold text-white">{fmtNum(r.sales)}</p>
                              {r.profit > 0 && <p className="text-[10px]" style={{ color: "#34d399" }}>{fmtNum(r.profit)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlassCard>
                )}
              </div>
            </div>

            {/* ── Transaction detail (full width, collapsible) ──────────────── */}
            <div>
              <button onClick={() => setShowTxn((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2 text-slate-300">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  รายละเอียดรายการขาย
                  <span className="text-[11px] font-normal text-slate-500">({filteredData.length.toLocaleString()} รายการ)</span>
                </div>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${showTxn ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTxn && (
                <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.07]" style={{ background: "rgba(255,255,255,0.03)" }}>
                          {[
                            { h: "วันที่", left: true, show: !!fields.date },
                            { h: fields.custName ? (config.find(f=>f.fieldName===fields.custName)?.label||"ลูกค้า") : "ลูกค้า", left: true, show: !!fields.custName },
                            { h: fields.program ? (config.find(f=>f.fieldName===fields.program)?.label||"รายการ") : "รายการ", left: true, show: !!fields.program },
                            { h: fields.quantity ? (config.find(f=>f.fieldName===fields.quantity)?.label||"จำนวน") : "จำนวน", left: false, show: !!fields.quantity },
                            { h: fields.sales ? (config.find(f=>f.fieldName===fields.sales)?.label||"ยอดรวม") : "ยอดรวม", left: false, show: !!fields.sales },
                            { h: fields.deposit ? (config.find(f=>f.fieldName===fields.deposit)?.label||"มัดจำ") : "มัดจำ", left: false, show: isRental && !!fields.deposit },
                            { h: fields.statusAny ? (config.find(f=>f.fieldName===fields.statusAny)?.label||"สถานะ") : "สถานะ", left: true, show: isRental && !!fields.statusAny },
                            { h: "ต้นทุน", left: false, show: !isRental && !!fields.cost },
                            { h: "กำไร",   left: false, show: !isRental && !!fields.profit },
                          ].filter(c => c.show).map(({ h, left }) => (
                            <th key={h} className={`px-4 py-3 font-bold text-slate-500 whitespace-nowrap ${left ? "text-left" : "text-right"}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData
                          .filter((r) => fields.custName ? String(r[fields.custName] ?? "").trim() : true)
                          .sort((a, b) => fields.date ? String(b[fields.date!] ?? "").localeCompare(String(a[fields.date!] ?? "")) : 0)
                          .map((r, i) => (
                            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                              {fields.date && <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(r[fields.date])}</td>}
                              {fields.custName && <td className="px-4 py-2.5 font-semibold text-slate-300 max-w-[140px] truncate">{String(r[fields.custName] ?? "-")}</td>}
                              {fields.program && <td className="px-4 py-2.5 text-slate-400 max-w-[140px] truncate">{String(r[fields.program] ?? "-")}</td>}
                              {fields.quantity && <td className="px-4 py-2.5 text-right"><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-400">{r[fields.quantity] || "-"}</span></td>}
                              {fields.sales && <td className="px-4 py-2.5 text-right font-semibold text-white whitespace-nowrap">{fmtFull(parseNum(r[fields.sales]))}</td>}
                              {isRental && fields.deposit && <td className="px-4 py-2.5 text-right text-blue-400 whitespace-nowrap">{fmtFull(parseNum(r[fields.deposit]))}</td>}
                              {isRental && fields.statusAny && (
                                <td className="px-4 py-2.5 text-left">
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.07] text-slate-300">{String(r[fields.statusAny] ?? "-")}</span>
                                </td>
                              )}
                              {!isRental && fields.cost && <td className="px-4 py-2.5 text-right text-slate-400 whitespace-nowrap">{fmtFull(parseNum(r[fields.cost]))}</td>}
                              {!isRental && fields.profit && <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "#34d399" }}>{fmtFull(parseNum(r[fields.profit]))}</td>}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty */}
        {!dataLoading && !dataError && allData.length === 0 && selectedMod && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <svg className="w-8 h-8 text-indigo-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-400 font-semibold">ยังไม่มีข้อมูลยอดขาย</p>
            <p className="text-slate-600 text-sm mt-1">{selectedMod.configName} · {selectedMod.sheetName}</p>
          </div>
        )}
      </div>

      {/* Customer modal */}
      {selCust && mounted && (
        <CustModal name={selCust} rows={custTxns} fields={fields} onClose={() => setSelCust(null)} />
      )}
    </div>
  );
}

export default function SalesDashboardDemoPage() {
  return <Suspense><SalesDashboardContent /></Suspense>;
}
