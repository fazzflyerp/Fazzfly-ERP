"use client";

// TODO(DEV): ปัจจุบันหน้านี้คำนวณ real-time จาก HelperS/U/E ทุกครั้งที่โหลด
// แผนอนาคต: Auto Upload sync → Finance sheet โดยตรง (เร็วขึ้นมาก)

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ComputedRow {
  period: string;
  computed: { revenue: number; cogs: number; expenses: number };
}

type ActiveType = "revenue" | "cogs" | "expenses";
type Mode = "mom" | "yoy" | "dod" | "compare";

interface DetailState {
  loading: boolean;
  period: string;
  type: ActiveType | null;
  headers: string[];
  rows: Record<string, string>[];
  error: string;
  debug?: any;
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calcChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

const MM_TO_THAI: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};
function fmtPeriod(p: string) {
  const [mm, yyyy] = p.split("/");
  return mm && yyyy ? `${MM_TO_THAI[mm] || mm} ${yyyy}` : p;
}

function extractDriveId(val: string): string | null {
  const m1 = val.match(/\/file\/d\/([A-Za-z0-9_-]{25,})/);
  if (m1) return m1[1];
  const m2 = val.match(/[?&]id=([A-Za-z0-9_-]{25,})/);
  if (m2) return m2[1];
  if (/^[A-Za-z0-9_-]{25,}$/.test(val.trim())) return val.trim();
  return null;
}

function DetailCell({ value }: { value: string }) {
  const id = extractDriveId(value);
  if (id) {
    return (
      <a
        href={`https://drive.google.com/file/d/${id}/view`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        ดูไฟล์
      </a>
    );
  }
  return <span>{value}</span>;
}

const TYPE_META: Record<ActiveType, { label: string; dot: string; cardBorder: string; cardBg: string; cardText: string }> = {
  revenue:  { label: "รายได้รวม",    dot: "bg-emerald-400", cardBorder: "border-emerald-500/40", cardBg: "bg-emerald-500/10", cardText: "text-emerald-400" },
  cogs:     { label: "ต้นทุนขาย",   dot: "bg-amber-400",   cardBorder: "border-amber-500/40",   cardBg: "bg-amber-500/10",   cardText: "text-amber-400"   },
  expenses: { label: "ค่าใช้จ่ายรวม", dot: "bg-rose-400",  cardBorder: "border-rose-500/40",    cardBg: "bg-rose-500/10",    cardText: "text-rose-400"    },
};

function ChangeBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className="text-slate-600 text-xs">—</span>;
  const positive = invert ? pct < 0 : pct > 0;
  const cls = positive ? "text-emerald-400" : pct === 0 ? "text-slate-500" : "text-red-400";
  return (
    <span className={`text-[11px] font-semibold ${cls}`}>
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function FinancePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";
  const sheetName     = searchParams.get("sheetName")     || "Finance";
  const moduleName    = searchParams.get("moduleName")    || "Financial Dashboard";

  const [role, setRole]               = useState("");
  const [branchName, setBranchName]   = useState("");
  const [branches, setBranches]       = useState<{ id: string; name: string }[]>([]);
  const [selBranch, setSelBranch]     = useState("");

  const [rows, setRows]         = useState<ComputedRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dataError, setDataError] = useState("");
  const [syncDebug, setSyncDebug] = useState<any>(null);

  const [liabilities, setLiabilities] = useState<{ liability_id: string; po_id: string; supplier_name: string; installment_no: string; due_date: string; amount: string; status: string }[]>([]);

  const [mode, setMode]           = useState<Mode>("mom");
  const [activeType, setActiveType] = useState<ActiveType | null>(null);
  const [activePeriod, setActivePeriod] = useState("");

  const [cmpAStart, setCmpAStart] = useState("");
  const [cmpAEnd, setCmpAEnd]     = useState("");
  const [cmpBStart, setCmpBStart] = useState("");
  const [cmpBEnd, setCmpBEnd]     = useState("");

  const [dodSort,    setDodSort]    = useState<"asc" | "desc">("asc");
  const [dodStart,   setDodStart]   = useState("");
  const [dodEnd,     setDodEnd]     = useState("");
  const [dodCmpMode, setDodCmpMode] = useState(false);
  const [dodAStart,  setDodAStart]  = useState("");
  const [dodAEnd,    setDodAEnd]    = useState("");
  const [dodBStart,  setDodBStart]  = useState("");
  const [dodBEnd,    setDodBEnd]    = useState("");

  const emptyDetail = (): DetailState => ({ loading: false, period: "", type: null, headers: [], rows: [], error: "" });
  const [compareDetails, setCompareDetails] = useState<Record<ActiveType, DetailState>>({
    revenue:  emptyDetail(),
    cogs:     emptyDetail(),
    expenses: emptyDetail(),
  });

  // ─── data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async (bid: string, bname: string) => {
    if (!spreadsheetId) return;
    setLoading(true);
    setDataError("");
    try {
      const qs = [
        bid   ? `&branchId=${encodeURIComponent(bid)}`     : "",
        bname ? `&branchName=${encodeURIComponent(bname)}` : "",
      ].join("");
      const res  = await fetch(
        `/api/finance/sync?spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetName=${encodeURIComponent(sheetName)}${qs}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
      setRows(data.rows || []);
      setSyncDebug(data.debugSync ?? null);
    } catch (e: any) { setDataError(e.message); }
    finally { setLoading(false); }
  }, [spreadsheetId, sheetName]);

  useEffect(() => {
    async function init() {
      try {
        const auth = await fetch("/api/auth/branch-check").then((r) => r.json());
        setRole(auth.role || "");
        setBranchName(auth.branchName || "");

        if (auth.role === "SUPER_ADMIN") {
          try {
            const bd   = await fetch("/api/auth/branches").then((r) => r.json());
            const list = (bd.branches || []).map((b: any) => ({ id: b.branchId, name: b.branchName }));
            setBranches([{ id: "", name: "ทั้งหมด" }, ...list]);
          } catch {
            setBranches([{ id: "", name: "ทั้งหมด" }]);
          }
          try {
            const liaRes = await fetch("/api/inv/liabilities?status=PENDING");
            if (liaRes.ok) setLiabilities((await liaRes.json()).liabilities || []);
          } catch { /* liabilities optional */ }
          await loadData("", "");
        } else {
          setSelBranch(auth.branchId || "");
          setBranchName(auth.branchName || "");
          await loadData(auth.branchId || "", auth.branchName || "");
        }
      } catch (e: any) { setDataError(e.message); setLoading(false); }
    }
    init();
  }, [loadData]);

  async function handleBranchChange(bid: string) {
    setSelBranch(bid);
    const bname = bid ? (branches.find((b) => b.id === bid)?.name || "") : "";
    setActivePeriod("");
    setCompareDetails({ revenue: emptyDetail(), cogs: emptyDetail(), expenses: emptyDetail() });
    await loadData(bid, bname);
  }

  // ─── detail fetching ──────────────────────────────────────────────────────────

  const fetchAllForPeriod = useCallback(async (period: string) => {
    if (!spreadsheetId) return;
    const bid   = selBranch;
    // SUPER_ADMIN no branch selected → no filter; ADMIN always has branchName from token
    const bname = selBranch
      ? (branches.find((b) => b.id === selBranch)?.name || "") || branchName
      : (role === "SUPER_ADMIN" ? "" : branchName);
    const branchMapObj: Record<string, string> = {};
    branches.forEach((b) => { if (b.id) branchMapObj[b.id] = b.name; });
    const branchMapJson = Object.keys(branchMapObj).length > 0 ? JSON.stringify(branchMapObj) : "";

    (["revenue", "cogs", "expenses"] as ActiveType[]).forEach((t) => {
      setCompareDetails((prev) => ({ ...prev, [t]: { loading: true, period, type: t, headers: [], rows: [], error: "" } }));
    });

    await Promise.all((["revenue", "cogs", "expenses"] as ActiveType[]).map(async (type) => {
      try {
        const params: Record<string, string> = { spreadsheetId, type };
        if (period)       params.period    = period;
        if (bid)          params.branchId  = bid;
        if (bname)        params.branchName = bname;
        if (branchMapJson) params.branchMap = branchMapJson;
        const qs  = new URLSearchParams(params);
        const res = await fetch(`/api/finance/detail?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
        setCompareDetails((prev) => ({ ...prev, [type]: { loading: false, period, type, headers: data.headers, rows: data.rows, error: "", debug: data.debug } }));
      } catch (e: any) {
        setCompareDetails((prev) => ({ ...prev, [type]: { loading: false, period, type, headers: [], rows: [], error: e.message } }));
      }
    }));
  }, [spreadsheetId, selBranch, branches, branchName, role]);

  const fetchAllDetailsRange = useCallback(async (start: string, end: string) => {
    if (!spreadsheetId) return;
    const bid   = selBranch;
    const bname = selBranch ? (branches.find((b) => b.id === selBranch)?.name || "") || branchName : "";
    const branchMapObj: Record<string, string> = {};
    branches.forEach((b) => { if (b.id) branchMapObj[b.id] = b.name; });
    const branchMapJson = Object.keys(branchMapObj).length > 0 ? JSON.stringify(branchMapObj) : "";
    const toMY = (d: string) => d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : "";

    (["revenue", "cogs", "expenses"] as ActiveType[]).forEach((t) => {
      setCompareDetails((prev) => ({ ...prev, [t]: { loading: true, period: "", type: t, headers: [], rows: [], error: "" } }));
    });

    await Promise.all((["revenue", "cogs", "expenses"] as ActiveType[]).map(async (type) => {
      try {
        const params: Record<string, string> = { spreadsheetId, type };
        if (start)        params.periodStart = toMY(start);
        if (end)          params.periodEnd   = toMY(end);
        if (bid)          params.branchId    = bid;
        if (bname)        params.branchName  = bname;
        if (branchMapJson) params.branchMap  = branchMapJson;
        const qs  = new URLSearchParams(params);
        const res = await fetch(`/api/finance/detail?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "โหลดไม่สำเร็จ");
        setCompareDetails((prev) => ({ ...prev, [type]: { loading: false, period: "", type, headers: data.headers, rows: data.rows, error: "" } }));
      } catch (e: any) {
        setCompareDetails((prev) => ({ ...prev, [type]: { loading: false, period: "", type, headers: [], rows: [], error: e.message } }));
      }
    }));
  }, [spreadsheetId, selBranch, branches, branchName]);

  // DoD: load all rows when mode switches to dod
  useEffect(() => {
    if (mode !== "dod") return;
    setActivePeriod("dod");
    setActiveType(null);
    fetchAllDetailsRange("", "");
  }, [mode]); // eslint-disable-line

  // Compare: auto-fetch ช่วง A when dates change
  useEffect(() => {
    if (mode !== "compare") return;
    if (!cmpAStart && !cmpAEnd) return;
    setActiveType(null);
    fetchAllDetailsRange(cmpAStart, cmpAEnd);
  }, [mode, cmpAStart, cmpAEnd]); // eslint-disable-line

  // ─── derived data ─────────────────────────────────────────────────────────────

  const isSA = role === "SUPER_ADMIN";

  const filteredRows = useMemo(() => rows, [rows]);

  const totalRevenue  = filteredRows.reduce((s, r) => s + r.computed.revenue,  0);
  const totalCogs     = filteredRows.reduce((s, r) => s + r.computed.cogs,     0);
  const totalExpenses = filteredRows.reduce((s, r) => s + r.computed.expenses, 0);
  const totalGross    = totalRevenue - totalCogs;
  const totalNet      = totalGross - totalExpenses;

  const selBranchLabel = isSA
    ? (branches.find((b) => b.id === selBranch)?.name || "ทั้งหมด")
    : (branchName || "สาขา");
  const currentBname = selBranch
    ? (branches.find((b) => b.id === selBranch)?.name || "")
    : branchName || "";

  // MoM: add prev row for change %
  const momRows = useMemo(() => {
    return filteredRows.map((row, i) => ({
      ...row,
      prev: i > 0 ? filteredRows[i - 1].computed : null,
    }));
  }, [filteredRows]);

  // YoY: group by year → columns, month → rows
  const yoyData = useMemo(() => {
    const years = Array.from(new Set(filteredRows.map((r) => r.period.split("/")[1]))).sort();
    const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
    type YoyCell = { revenue: number; cogs: number; net: number } | null;
    const matrix: Record<string, Record<string, YoyCell>> = {};
    months.forEach((m) => { matrix[m] = {}; years.forEach((y) => { matrix[m][y] = null; }); });
    filteredRows.forEach((r) => {
      const [mm, yyyy] = r.period.split("/");
      if (!mm || !yyyy) return;
      const { revenue, cogs, expenses } = r.computed;
      matrix[mm][yyyy] = { revenue, cogs, net: revenue - cogs - expenses };
    });
    return { years, months, matrix };
  }, [filteredRows]);

  // ─── rendering helpers ────────────────────────────────────────────────────────

  function renderTable(d: DetailState) {
    if (d.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      );
    }
    if (d.error) return <div className="px-6 py-8 text-center text-red-400 text-xs">{d.error}</div>;
    if (d.rows.length === 0) return <div className="px-6 py-8 text-center text-slate-600 text-xs">ไม่พบรายการ</div>;
    return (
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0a0f1e]/90 backdrop-blur-sm">
            <tr className="text-left text-slate-500 border-b border-white/5">
              {d.headers.map((h) => (
                <th key={h} className="px-4 py-2.5 whitespace-nowrap font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row, i) => (
              <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                {d.headers.map((h) => (
                  <td key={h} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                    <DetailCell value={row[h] ?? ""} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── DoD helpers ─────────────────────────────────────────────────────────────

  function normDateKey(d: string): string {
    // dd/mm/yyyy → yyyy-mm-dd (for sorting)
    const m1 = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    // yyyy-mm-dd already sortable
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    return d;
  }

  function fmtDateDisplay(sortKey: string): string {
    // yyyy-mm-dd → dd/mm/yyyy Thai display
    const m = sortKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return sortKey;
  }

  function getDateCol(_type: ActiveType): string {
    return "วันที่";
  }

  function getAmountCol(type: ActiveType): string {
    return type === "revenue" ? "ยอดเงิน" : type === "cogs" ? "ยอดต้นทุน" : "";
  }

  function parseAmount(type: ActiveType, row: Record<string, string>, headers: string[]): number {
    // strip currency symbols, commas, spaces — keep digits, dot, minus
    const clean = (s: string) => parseFloat(s.replace(/[^\d.\-]/g, ""));
    const preferred = getAmountCol(type);
    if (preferred && row[preferred] !== undefined) {
      const n = clean(row[preferred]);
      if (!isNaN(n)) return n;
    }
    // fallback: first header that looks like a monetary column
    for (const h of headers) {
      if (h.startsWith("ยอด") || h.includes("เงิน") || h.includes("ต้นทุน") || h.includes("amount")) {
        const n = clean(row[h] ?? "");
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  }

  function renderDodView() {
    const TYPES = ["revenue", "cogs", "expenses"] as ActiveType[];
    const anyLoading = TYPES.some((t) => compareDetails[t].loading);
    if (anyLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      );
    }
    const errors = TYPES.map((t) => compareDetails[t].error).filter(Boolean);
    if (errors.length === TYPES.length) {
      return <div className="px-6 py-8 text-center text-red-400 text-xs">{errors[0]}</div>;
    }

    // Build unified row list with date key + amount
    const allRows = TYPES.flatMap((t) =>
      compareDetails[t].rows.map((row) => ({
        type: t,
        row,
        headers: compareDetails[t].headers,
        dateKey: normDateKey((row[getDateCol(t)] ?? "").toString()),
        dateRaw: (row[getDateCol(t)] ?? "").toString(),
        amount:  parseAmount(t, row, compareDetails[t].headers),
      }))
    );

    // ── Compare mode ─────────────────────────────────────────────────
    if (dodCmpMode) {
      const filterPeriod = (start: string, end: string) =>
        allRows.filter((r) => {
          if (!r.dateKey || r.dateKey === "—") return false;
          if (start && r.dateKey < start) return false;
          if (end   && r.dateKey > end)   return false;
          return true;
        });

      const pA = filterPeriod(dodAStart, dodAEnd);
      const pB = filterPeriod(dodBStart, dodBEnd);

      const sum = (rows: typeof allRows, type: ActiveType) =>
        rows.filter((r) => r.type === type).reduce((s, r) => s + r.amount, 0);

      const totA = { rev: sum(pA,"revenue"), cog: sum(pA,"cogs"), exp: sum(pA,"expenses") };
      const totB = { rev: sum(pB,"revenue"), cog: sum(pB,"cogs"), exp: sum(pB,"expenses") };
      const netA = totA.rev - totA.cog - totA.exp;
      const netB = totB.rev - totB.cog - totB.exp;

      const hasA = dodAStart || dodAEnd;
      const hasB = dodBStart || dodBEnd;

      if (!hasA && !hasB) {
        return (
          <div className="px-6 py-12 text-center text-slate-600 text-sm">
            กรุณาเลือกช่วงวันที่ A และ B เพื่อเปรียบเทียบ
          </div>
        );
      }

      const labelA = hasA ? `${dodAStart || "…"} – ${dodAEnd || "…"}` : "ทั้งหมด";
      const labelB = hasB ? `${dodBStart || "…"} – ${dodBEnd || "…"}` : "ทั้งหมด";

      type CmpRow = { label: string; valA: number; valB: number; invert?: boolean; color: string };
      const cmpRows: CmpRow[] = [
        { label: "รายได้รวม",   valA: totA.rev, valB: totB.rev, color: "text-emerald-400" },
        { label: "ต้นทุนขาย",   valA: totA.cog, valB: totB.cog, invert: true, color: "text-amber-400" },
        { label: "ค่าใช้จ่าย",  valA: totA.exp, valB: totB.exp, invert: true, color: "text-rose-400" },
        { label: "กำไรสุทธิ",   valA: netA,     valB: netB,     color: netA >= 0 && netB >= 0 ? "text-purple-400" : "text-slate-300" },
      ];

      return (
        <div className="divide-y divide-white/5">
          {/* Header */}
          <div className="grid grid-cols-4 px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <div>รายการ</div>
            <div className="text-right text-violet-400">ช่วง A · {pA.length} รายการ<br/><span className="text-[9px] font-normal text-slate-600">{labelA}</span></div>
            <div className="text-right text-blue-400">ช่วง B · {pB.length} รายการ<br/><span className="text-[9px] font-normal text-slate-600">{labelB}</span></div>
            <div className="text-right">เปลี่ยนแปลง</div>
          </div>

          {cmpRows.map(({ label, valA, valB, invert, color }) => {
            const pct = calcChange(valB, valA); // B vs A
            const isPositive = pct !== null && (invert ? pct < 0 : pct > 0);
            const isNegative = pct !== null && (invert ? pct > 0 : pct < 0);
            return (
              <div key={label} className="grid grid-cols-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="text-xs font-medium text-slate-300">{label}</div>
                <div className={`text-right text-sm font-bold ${color}`}>
                  ฿{fmt(valA)}
                  <p className="text-[10px] font-normal text-slate-600">
                    {pA.filter((r) => r.type === (label === "รายได้รวม" ? "revenue" : label === "ต้นทุนขาย" ? "cogs" : label === "ค่าใช้จ่าย" ? "expenses" : null as any)).length} รายการ
                  </p>
                </div>
                <div className={`text-right text-sm font-bold ${color}`}>
                  ฿{fmt(valB)}
                  <p className="text-[10px] font-normal text-slate-600">
                    {pB.filter((r) => r.type === (label === "รายได้รวม" ? "revenue" : label === "ต้นทุนขาย" ? "cogs" : label === "ค่าใช้จ่าย" ? "expenses" : null as any)).length} รายการ
                  </p>
                </div>
                <div className="text-right">
                  {pct === null ? (
                    <span className="text-slate-600 text-xs">—</span>
                  ) : (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      isPositive ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : isNegative ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-slate-400 bg-white/5 border-white/10"
                    }`}>
                      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Day-by-day breakdown for both periods */}
          {(hasA || hasB) && (() => {
            const makeGroups = (rows: typeof allRows) => {
              const m = new Map<string, typeof allRows>();
              const sorted = [...rows].sort((a, b) =>
                dodSort === "asc" ? a.dateKey.localeCompare(b.dateKey) : b.dateKey.localeCompare(a.dateKey)
              );
              for (const r of sorted) {
                const k = r.dateKey || "—";
                if (!m.has(k)) m.set(k, []);
                m.get(k)!.push(r);
              }
              return m;
            };
            const grpA = makeGroups(pA);
            const grpB = makeGroups(pB);
            const allDates = [...new Set([...grpA.keys(), ...grpB.keys()])].sort((a, b) =>
              dodSort === "asc" ? a.localeCompare(b) : b.localeCompare(a)
            );
            if (allDates.length === 0) return null;
            return (
              <div className="border-t border-white/5">
                <div className="grid grid-cols-4 px-5 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider border-b border-white/5">
                  <div>วันที่</div>
                  <div className="text-right text-violet-400/60">ช่วง A · กำไรสุทธิ</div>
                  <div className="text-right text-blue-400/60">ช่วง B · กำไรสุทธิ</div>
                  <div className="text-right">เปลี่ยนแปลง</div>
                </div>
                {allDates.map((dk) => {
                  const dA = grpA.get(dk) ?? [];
                  const dB = grpB.get(dk) ?? [];
                  const nA = dA.filter(r=>r.type==="revenue").reduce((s,r)=>s+r.amount,0)
                           - dA.filter(r=>r.type==="cogs").reduce((s,r)=>s+r.amount,0)
                           - dA.filter(r=>r.type==="expenses").reduce((s,r)=>s+r.amount,0);
                  const nB = dB.filter(r=>r.type==="revenue").reduce((s,r)=>s+r.amount,0)
                           - dB.filter(r=>r.type==="cogs").reduce((s,r)=>s+r.amount,0)
                           - dB.filter(r=>r.type==="expenses").reduce((s,r)=>s+r.amount,0);
                  const pct = calcChange(nB, nA);
                  return (
                    <div key={dk} className="grid grid-cols-4 px-5 py-2.5 hover:bg-white/[0.02] border-b border-white/[0.03] transition-colors">
                      <div className="text-xs text-slate-400">{fmtDateDisplay(dk)}</div>
                      <div className={`text-right text-xs font-semibold ${dA.length ? (nA>=0?"text-emerald-400":"text-red-400") : "text-slate-700"}`}>
                        {dA.length ? `${nA>=0?"+":""}฿${fmt(nA)}` : "—"}
                      </div>
                      <div className={`text-right text-xs font-semibold ${dB.length ? (nB>=0?"text-emerald-400":"text-red-400") : "text-slate-700"}`}>
                        {dB.length ? `${nB>=0?"+":""}฿${fmt(nB)}` : "—"}
                      </div>
                      <div className="text-right">
                        {pct === null || !dA.length || !dB.length ? (
                          <span className="text-slate-700 text-xs">—</span>
                        ) : (
                          <span className={`text-xs font-medium ${pct > 0 ? "text-emerald-400" : pct < 0 ? "text-red-400" : "text-slate-500"}`}>
                            {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      );
    }

    // Client-side date range filter
    const filtered = allRows.filter((r) => {
      if (!r.dateKey || r.dateKey === "—") return true;
      if (dodStart && r.dateKey < dodStart) return false;
      if (dodEnd   && r.dateKey > dodEnd)   return false;
      return true;
    });

    if (filtered.length === 0) {
      return <div className="px-6 py-8 text-center text-slate-600 text-xs">ไม่พบรายการในช่วงที่เลือก</div>;
    }

    // Overall totals (of filtered rows)
    const totals = {
      revenue:  filtered.filter((r) => r.type === "revenue").reduce((s, r) => s + r.amount, 0),
      cogs:     filtered.filter((r) => r.type === "cogs").reduce((s, r) => s + r.amount, 0),
      expenses: filtered.filter((r) => r.type === "expenses").reduce((s, r) => s + r.amount, 0),
    };
    const netTotal = totals.revenue - totals.cogs - totals.expenses;

    // Group by date, sorted by dodSort
    const grouped = new Map<string, typeof allRows>();
    const sortedRows = [...filtered].sort((a, b) =>
      dodSort === "asc" ? a.dateKey.localeCompare(b.dateKey) : b.dateKey.localeCompare(a.dateKey)
    );
    for (const row of sortedRows) {
      const k = row.dateKey || "—";
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(row);
    }

    const typeStyle: Record<ActiveType, { border: string; badge: string }> = {
      revenue:  { border: "border-l-emerald-500", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
      cogs:     { border: "border-l-amber-500",   badge: "text-amber-400   bg-amber-500/10   border-amber-500/25"   },
      expenses: { border: "border-l-rose-500",    badge: "text-rose-400    bg-rose-500/10    border-rose-500/25"    },
    };

    return (
      <div>
        {/* Overall summary */}
        <div className="px-5 py-4 border-b border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">รายได้รวม</p>
            <p className="text-sm font-bold text-emerald-400">฿{fmt(totals.revenue)}</p>
            <p className="text-[10px] text-slate-600">{filtered.filter((r) => r.type === "revenue").length} รายการ</p>
          </div>
          <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">ต้นทุนขาย</p>
            <p className="text-sm font-bold text-amber-400">฿{fmt(totals.cogs)}</p>
            <p className="text-[10px] text-slate-600">{filtered.filter((r) => r.type === "cogs").length} รายการ</p>
          </div>
          <div className="bg-rose-500/8 border border-rose-500/15 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">ค่าใช้จ่าย</p>
            <p className="text-sm font-bold text-rose-400">฿{fmt(totals.expenses)}</p>
            <p className="text-[10px] text-slate-600">{filtered.filter((r) => r.type === "expenses").length} รายการ</p>
          </div>
          <div className={`border rounded-xl p-3 ${netTotal >= 0 ? "bg-purple-500/8 border-purple-500/15" : "bg-red-500/8 border-red-500/15"}`}>
            <p className="text-[10px] text-slate-500 mb-0.5">กำไรสุทธิ</p>
            <p className={`text-sm font-bold ${netTotal >= 0 ? "text-purple-400" : "text-red-400"}`}>
              {netTotal >= 0 ? "+" : ""}฿{fmt(netTotal)}
            </p>
            <p className="text-[10px] text-slate-600">{grouped.size} วัน</p>
          </div>
        </div>

        {/* Grouped by date */}
        <div className="overflow-auto max-h-[640px]">
          <table className="w-full table-fixed text-[11px]">
            <colgroup>
              {/* badge */}<col style={{ width: "80px" }} />
              {/* รายการ */}<col style={{ width: "150px" }} />
              {/* จำนวน */}<col style={{ width: "68px" }} />
              {/* ยอดเงิน */}<col style={{ width: "100px" }} />
              {/* สาขา */}<col />
            </colgroup>
          {Array.from(grouped.entries()).map(([dateKey, dayRows]) => {
            const dayRev = dayRows.filter((r) => r.type === "revenue").reduce((s, r) => s + r.amount, 0);
            const dayCog = dayRows.filter((r) => r.type === "cogs").reduce((s, r) => s + r.amount, 0);
            const dayExp = dayRows.filter((r) => r.type === "expenses").reduce((s, r) => s + r.amount, 0);
            const dayNet = dayRev - dayCog - dayExp;
            const displayDate = fmtDateDisplay(dateKey);

            return (
              <tbody key={dateKey}>
                {/* Date header */}
                <tr>
                  <td colSpan={5} className="sticky top-0 z-10 bg-[#0d1424]/95 backdrop-blur-sm border-y border-white/[0.06] px-4 py-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-bold text-white">{displayDate}</span>
                      <span className="text-[10px] text-slate-500">{dayRows.length} รายการ</span>
                      <div className="flex items-center gap-3 ml-auto flex-wrap">
                        {dayRev > 0 && <span className="text-[11px] font-semibold text-emerald-400">+฿{fmt(dayRev)}</span>}
                        {dayCog > 0 && <span className="text-[11px] font-semibold text-amber-400">-฿{fmt(dayCog)}</span>}
                        {dayExp > 0 && <span className="text-[11px] font-semibold text-rose-400">-฿{fmt(dayExp)}</span>}
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${dayNet >= 0 ? "text-purple-300 bg-purple-500/15" : "text-red-300 bg-red-500/15"}`}>
                          {dayNet >= 0 ? "+" : ""}฿{fmt(dayNet)}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
                {/* Rows */}
                {dayRows.map(({ type, row }, i) => {
                  const s        = typeStyle[type];
                  const nameCol  = { revenue: "โปรแกรม", cogs: "ชื่อสินค้า", expenses: "หมวดค่าใช้จ่าย" }[type];
                  const nameLabel= { revenue: "โปรแกรม", cogs: "ชื่อสินค้า", expenses: "หมวด" }[type];
                  const qtyCol   = { revenue: "จำนวนที่ใช้", cogs: "จำนวนที่ใช้", expenses: "" }[type];
                  const amtCol   = { revenue: "ยอดเงิน", cogs: "ยอดต้นทุน", expenses: "ยอดเงิน" }[type];
                  const amtLabel = { revenue: "ยอดเงิน", cogs: "ต้นทุน", expenses: "ยอดเงิน" }[type];
                  return (
                    <tr key={i} className={`border-t border-white/[0.03] border-l-2 ${s.border} hover:bg-white/[0.03] transition-colors`}>
                      <td className="px-4 py-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badge} whitespace-nowrap`}>
                          {TYPE_META[type].label}
                        </span>
                      </td>
                      <td className="px-2 py-2 truncate max-w-0">
                        <p className="text-[9px] text-slate-600 leading-none mb-0.5">{nameLabel}</p>
                        <p className="text-slate-300 truncate">{row[nameCol] ?? ""}</p>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {qtyCol ? (
                          <>
                            <p className="text-[9px] text-slate-600 leading-none mb-0.5">จำนวน</p>
                            <p className="text-slate-300">{row[qtyCol] ?? ""}</p>
                          </>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <p className="text-[9px] text-slate-600 leading-none mb-0.5">{amtLabel}</p>
                        <p className="text-slate-300 font-medium"><DetailCell value={row[amtCol] ?? ""} /></p>
                      </td>
                      <td className="px-4 py-2 truncate max-w-0">
                        <p className="text-[9px] text-slate-600 leading-none mb-0.5">สาขา</p>
                        <p className="text-slate-400 truncate">{row["สาขา"] ?? ""}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
          </table>
        </div>
      </div>
    );
  }

  function renderMergedList() {
    const TYPES = ["revenue", "cogs", "expenses"] as ActiveType[];
    const anyLoading = TYPES.some((t) => compareDetails[t].loading);
    if (anyLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        </div>
      );
    }
    const typeStyle: Record<ActiveType, { border: string; badge: string }> = {
      revenue:  { border: "border-l-emerald-500", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
      cogs:     { border: "border-l-amber-500",   badge: "text-amber-400   bg-amber-500/10   border-amber-500/25"   },
      expenses: { border: "border-l-rose-500",    badge: "text-rose-400    bg-rose-500/10    border-rose-500/25"    },
    };
    const allRows = TYPES.flatMap((t) =>
      compareDetails[t].rows.map((row) => ({ type: t, row, headers: compareDetails[t].headers }))
    );
    // per-type status bar — shows count or error for each type
    const statusBar = (
      <div className="flex flex-col gap-1 px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
        <div className="flex gap-3 flex-wrap">
          {TYPES.map((t) => {
            const d = compareDetails[t];
            return (
              <span key={t} className="text-[10px] font-medium flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_META[t].dot}`} />
                <span className="text-slate-500">{TYPE_META[t].label}</span>
                {d.error
                  ? <span className="text-red-400 ml-0.5">error: {d.error}</span>
                  : <span className="text-slate-600 ml-0.5">{d.rows.length} รายการ</span>
                }
              </span>
            );
          })}
        </div>
        {/* Debug info: show when any type has 0 rows and debug data is available */}
        {TYPES.filter((t) => !compareDetails[t].loading && compareDetails[t].rows.length === 0 && compareDetails[t].debug).map((t) => {
          const dbg = compareDetails[t].debug!;
          return (
            <div key={t} className="mt-1 text-[9px] font-mono text-amber-500/80 bg-amber-500/5 border border-amber-500/15 rounded px-2 py-1 space-y-0.5">
              <div className="font-bold text-amber-400">[debug:{t}] 0 rows</div>
              {dbg.headerAtCols && (
                <div>cols → period[{dbg.headerAtCols.periodCol?.idx}]=&quot;{dbg.headerAtCols.periodCol?.header}&quot; branch[{dbg.headerAtCols.branchCol?.idx}]=&quot;{dbg.headerAtCols.branchCol?.header}&quot;</div>
              )}
              <div>period filter: &quot;{dbg.normTarget}&quot; · passedPeriod: {dbg.passedPeriodFilter} · totalRows: {dbg.totalDataRows}</div>
              {dbg.filterByName
                ? <div>branchName=&quot;{dbg.branchNameReceived}&quot; · sampleBranch={JSON.stringify(dbg.sampleBranchValues)}</div>
                : <div>branchId=&quot;{dbg.branchIdReceived}&quot; · sampleBranch={JSON.stringify(dbg.sampleBranchValues)}</div>
              }
              {dbg.samplePeriods?.length > 0 && (
                <div>samplePeriods={JSON.stringify(dbg.samplePeriods)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
    if (allRows.length === 0) {
      return (
        <>
          {statusBar}
          <div className="px-6 py-8 text-center text-slate-600 text-xs">ไม่พบรายการ</div>
        </>
      );
    }
    const NAME_COL: Record<ActiveType, string> = { revenue: "โปรแกรม", cogs: "ชื่อสินค้า", expenses: "หมวดค่าใช้จ่าย" };
    const QTY_COL:  Record<ActiveType, string> = { revenue: "จำนวนที่ใช้", cogs: "จำนวนที่ใช้", expenses: "" };
    const AMT_COL:  Record<ActiveType, string> = { revenue: "ยอดเงิน", cogs: "ยอดต้นทุน", expenses: "ยอดเงิน" };

    return (
      <div>
        {statusBar}
        <div className="overflow-auto max-h-[580px]">
          <table className="w-full table-fixed text-[11px]">
            <colgroup>
              <col style={{ width: "80px" }} />   {/* badge */}
              <col style={{ width: "88px" }} />   {/* วันที่ */}
              <col style={{ width: "150px" }} />  {/* รายการ */}
              <col style={{ width: "68px" }} />   {/* จำนวน */}
              <col style={{ width: "100px" }} />  {/* ยอดเงิน */}
              <col />                              {/* สาขา — flexible */}
            </colgroup>
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-1.5 text-left text-[9px] font-medium text-slate-600 uppercase tracking-wider">ประเภท</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-medium text-slate-600 uppercase tracking-wider">วันที่</th>
                <th className="px-2 py-1.5 text-left text-[9px] font-medium text-slate-600 uppercase tracking-wider">รายการ</th>
                <th className="px-2 py-1.5 text-right text-[9px] font-medium text-slate-600 uppercase tracking-wider">จำนวน</th>
                <th className="px-2 py-1.5 text-right text-[9px] font-medium text-slate-600 uppercase tracking-wider">ยอดเงิน</th>
                <th className="px-4 py-1.5 text-left text-[9px] font-medium text-slate-600 uppercase tracking-wider">สาขา</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ type, row }, i) => {
                const s = typeStyle[type];
                const nameLabel = NAME_COL[type];
                const amtLabel  = AMT_COL[type];
                return (
                  <tr key={i} className={`border-t border-white/[0.04] border-l-2 ${s.border} hover:bg-white/[0.03] transition-colors`}>
                    <td className="px-4 py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badge} whitespace-nowrap`}>
                        {TYPE_META[type].label}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <p className="text-[9px] text-slate-600 leading-none mb-0.5">วันที่</p>
                      <p className="text-slate-400 whitespace-nowrap"><DetailCell value={row["วันที่"] ?? ""} /></p>
                    </td>
                    <td className="px-2 py-2 truncate max-w-0">
                      <p className="text-[9px] text-slate-600 leading-none mb-0.5 truncate">{nameLabel}</p>
                      <p className="text-slate-300 truncate">{row[NAME_COL[type]] ?? ""}</p>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {QTY_COL[type] ? (
                        <>
                          <p className="text-[9px] text-slate-600 leading-none mb-0.5">จำนวน</p>
                          <p className="text-slate-300">{row[QTY_COL[type]] ?? ""}</p>
                        </>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <p className="text-[9px] text-slate-600 leading-none mb-0.5">{amtLabel}</p>
                      <p className="text-slate-300 font-medium"><DetailCell value={row[AMT_COL[type]] ?? ""} /></p>
                    </td>
                    <td className="px-4 py-2 truncate max-w-0">
                      <p className="text-[9px] text-slate-600 leading-none mb-0.5">สาขา</p>
                      <p className="text-slate-400 truncate">{row["สาขา"] ?? ""}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const isCompare  = mode === "compare";
  const isDod      = mode === "dod";
  const showPnL    = mode === "mom" || mode === "yoy";
  const showDetail = activePeriod || (isCompare && (cmpAStart || cmpAEnd));

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-600/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-600/6 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center" style={{ boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">{moduleName}</h1>
          <p className="text-slate-500 text-xs">{selBranchLabel} · {filteredRows.length} งวด</p>
        </div>
        <button
          onClick={() => loadData(selBranch, currentBname)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          รีโหลด
        </button>
      </header>

      {/* Branch switcher (SA only) */}
      {isSA && branches.length > 1 && (
        <div className="relative z-10 border-b border-white/5 bg-white/[0.01] px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 uppercase tracking-wider">สาขา</span>
            <div className="flex gap-2 flex-wrap">
              {branches.map((b) => (
                <button
                  key={b.id || "__all__"}
                  onClick={() => handleBranchChange(b.id)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    selBranch === b.id
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg"
                      : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6 space-y-6">
        {dataError && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{dataError}</div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(
            [
              { label: "รายได้รวม",     value: totalRevenue,  type: "revenue"  as ActiveType, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
              { label: "ต้นทุนขาย",     value: totalCogs,     type: "cogs"     as ActiveType, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
              { label: "กำไรขั้นต้น",   value: totalGross,    type: null,                     color: totalGross >= 0 ? "text-blue-400" : "text-red-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { label: "ค่าใช้จ่ายรวม", value: totalExpenses, type: "expenses" as ActiveType, color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20"    },
              { label: "กำไรสุทธิ",     value: totalNet,      type: null,                     color: totalNet >= 0 ? "text-purple-400" : "text-red-400", bg: totalNet >= 0 ? "bg-purple-500/10" : "bg-red-500/10", border: totalNet >= 0 ? "border-purple-500/20" : "border-red-500/20" },
            ] as { label: string; value: number; type: ActiveType | null; color: string; bg: string; border: string }[]
          ).map(({ label, value, type, color, bg, border }) => {
            const isActive = type && activeType === type;
            return (
              <div
                key={label}
                onClick={() => {
                  if (!type) return;
                  setActiveType((prev) => prev === type ? null : type);
                }}
                className={`${bg} border rounded-2xl p-4 transition-all ${
                  type ? "cursor-pointer hover:brightness-110" : ""
                } ${isActive ? `${border} ring-2 ring-offset-0 ring-offset-transparent brightness-110` : border}`}
              >
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>฿{fmt(value)}</p>
                {type && isActive && (
                  <p className="text-[10px] text-slate-500 mt-0.5">คลิกเพื่อยกเลิก</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Liabilities widget — SA only */}
        {isSA && (() => {
          const isOverdue = (due: string) => {
            const p = due.split("/");
            if (p.length !== 3) return false;
            return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])) < new Date();
          };
          const totalOutstanding = liabilities.reduce((s, l) => s + Number(l.amount || 0), 0);
          const overdue  = liabilities.filter((l) => isOverdue(l.due_date));
          const upcoming = liabilities.filter((l) => !isOverdue(l.due_date)).slice(0, 3);
          return (
            <div className="bg-violet-500/[0.06] border border-violet-500/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-violet-300">หนี้สินค้างชำระ</span>
                  {overdue.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 font-medium">
                      เกินกำหนด {overdue.length} งวด
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push("/ERP/inv/liabilities")}
                  className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                >
                  ดูทั้งหมด
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
              {liabilities.length === 0 ? (
                <p className="text-xs text-slate-600">ไม่มีหนี้สินค้างชำระ</p>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-0.5">ยอดค้างทั้งหมด</p>
                    <p className="text-lg font-bold text-violet-400">฿{totalOutstanding.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-600">{liabilities.length} งวด</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2">
                      {overdue.map((l) => (
                        <div key={l.liability_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                          <span className="text-[10px] font-mono text-red-400">{l.po_id}</span>
                          <span className="text-[10px] text-red-400/70">งวด {l.installment_no}</span>
                          <span className="text-[10px] font-semibold text-red-300">฿{Number(l.amount).toLocaleString()}</span>
                          <span className="text-[10px] text-red-500">{l.due_date}</span>
                        </div>
                      ))}
                      {upcoming.map((l) => (
                        <div key={l.liability_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                          <span className="text-[10px] font-mono text-slate-400">{l.po_id}</span>
                          <span className="text-[10px] text-slate-500">งวด {l.installment_no}</span>
                          <span className="text-[10px] font-semibold text-slate-300">฿{Number(l.amount).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500">{l.due_date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Mode / filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          {isCompare ? (
            <>
              <button
                onClick={() => { setMode("mom"); setCmpAStart(""); setCmpAEnd(""); setCmpBStart(""); setCmpBEnd(""); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                ออก
              </button>
              <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[11px] font-semibold">เปรียบเทียบ 2 ช่วง</span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-500">ช่วง A</span>
                <input type="date" value={cmpAStart} onChange={(e) => setCmpAStart(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                <span className="text-slate-600 text-xs">–</span>
                <input type="date" value={cmpAEnd} onChange={(e) => setCmpAEnd(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
              </div>
              <span className="text-slate-600 text-xs px-1">vs</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">ช่วง B</span>
                <input type="date" value={cmpBStart} onChange={(e) => setCmpBStart(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                <span className="text-slate-600 text-xs">–</span>
                <input type="date" value={cmpBEnd} onChange={(e) => setCmpBEnd(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
              </div>
              {(cmpAStart || cmpAEnd || cmpBStart || cmpBEnd) && (
                <button
                  onClick={() => { setCmpAStart(""); setCmpAEnd(""); setCmpBStart(""); setCmpBEnd(""); }}
                  className="text-[11px] text-slate-500 hover:text-red-400 transition-colors px-2"
                >
                  ล้าง
                </button>
              )}
            </>
          ) : (
            <>
              {(["mom", "yoy", "dod"] as Mode[]).map((m) => {
                const labels: Record<string, string> = { mom: "Month over Month", yoy: "Year over Year", dod: "Day over Day" };
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setActiveType(null);
                      if (m !== "dod") setActivePeriod("");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      mode === m
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg"
                        : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {labels[m]}
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-slate-600">{filteredRows.length} งวด</span>
            </>
          )}
        </div>

        {/* DoD filter bar */}
        {isDod && (
          <div className="flex flex-wrap items-center gap-2">
            {dodCmpMode ? (
              <>
                <button
                  onClick={() => { setDodCmpMode(false); setDodAStart(""); setDodAEnd(""); setDodBStart(""); setDodBEnd(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  ออก
                </button>
                <span className="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 text-[11px] font-semibold">เปรียบเทียบ 2 ช่วง</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">ช่วง A</span>
                  <input type="date" value={dodAStart} onChange={(e) => setDodAStart(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                  <span className="text-slate-600 text-xs">–</span>
                  <input type="date" value={dodAEnd} onChange={(e) => setDodAEnd(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                </div>
                <span className="text-slate-600 text-xs px-1">vs</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500">ช่วง B</span>
                  <input type="date" value={dodBStart} onChange={(e) => setDodBStart(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                  <span className="text-slate-600 text-xs">–</span>
                  <input type="date" value={dodBEnd} onChange={(e) => setDodBEnd(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-violet-500/50" />
                </div>
                {(dodAStart || dodAEnd || dodBStart || dodBEnd) && (
                  <button onClick={() => { setDodAStart(""); setDodAEnd(""); setDodBStart(""); setDodBEnd(""); }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-1">ล้าง</button>
                )}
                <button onClick={() => setDodSort((s) => s === "asc" ? "desc" : "asc")}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                  {dodSort === "asc" ? "เก่า → ใหม่" : "ใหม่ → เก่า"}
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500">ช่วงวันที่</span>
                <input type="date" value={dodStart} onChange={(e) => setDodStart(e.target.value)}
                  className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/50" />
                <span className="text-slate-600 text-xs">–</span>
                <input type="date" value={dodEnd} onChange={(e) => setDodEnd(e.target.value)}
                  className="px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/50" />
                {(dodStart || dodEnd) && (
                  <button onClick={() => { setDodStart(""); setDodEnd(""); }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-1">ล้าง</button>
                )}
                <button onClick={() => setDodSort((s) => s === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                  {dodSort === "asc" ? "เก่า → ใหม่" : "ใหม่ → เก่า"}
                </button>
                <button onClick={() => setDodCmpMode(true)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/15 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                  เปรียบเทียบ 2 ช่วง
                </button>
              </>
            )}
          </div>
        )}

        {/* Sync debug — แสดงเมื่อ revenue = 0 ทุกงวด */}
        {syncDebug && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-4 text-[10px] font-mono text-amber-400/80 space-y-1">
            <div className="font-bold text-amber-400 text-xs">[debug:sync] revenue = 0 ทุกงวด</div>
            <div>branchName sent: &quot;{syncDebug.branchNameReceived}&quot; · HelperS rows: {syncDebug.helperSRows}</div>
            {syncDebug.sampleHelperS?.map((s: any, i: number) => (
              <div key={i}>row{i+1}: period=&quot;{s.period}&quot;({s.periodNorm}) amount=&quot;{s.amount}&quot; branch=&quot;{s.branchName}&quot;</div>
            ))}
            <div>revenueMap: {JSON.stringify(syncDebug.revenueMapEntries)}</div>
          </div>
        )}

        {/* P&L Table — MoM */}
        {showPnL && mode === "mom" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-white font-semibold text-sm">กำไร-ขาดทุน — Month over Month</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-600 text-sm">ไม่พบข้อมูล</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="px-5 py-3.5">งวด</th>
                      <th className="px-5 py-3.5 text-right">รายได้รวม</th>
                      <th className="px-3 py-3.5"></th>
                      <th className="px-5 py-3.5 text-right">ต้นทุนขาย</th>
                      <th className="px-3 py-3.5"></th>
                      <th className="px-5 py-3.5 text-right">กำไรขั้นต้น</th>
                      <th className="px-5 py-3.5 text-right">ค่าใช้จ่ายรวม</th>
                      <th className="px-3 py-3.5"></th>
                      <th className="px-5 py-3.5 text-right">กำไรสุทธิ</th>
                      <th className="px-5 py-3.5 text-center">GM%</th>
                      <th className="px-5 py-3.5 text-center">NM%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {momRows.map(({ period, computed, prev }) => {
                      const { revenue, cogs, expenses } = computed;
                      const gross = revenue - cogs;
                      const net   = gross - expenses;
                      const isActive = activePeriod === period;
                      return (
                        <tr
                          key={period}
                          onClick={() => {
                            if (activePeriod === period) {
                              setActivePeriod("");
                            } else {
                              setActivePeriod(period);
                              setActiveType(null);
                              fetchAllForPeriod(period);
                            }
                          }}
                          className={`border-t border-white/5 cursor-pointer transition-colors ${isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                        >
                          <td className="px-5 py-4">
                            <span className="text-white font-medium">{fmtPeriod(period)}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-semibold ${revenue > 0 ? "text-emerald-400" : "text-slate-600"}`}>฿{fmt(revenue)}</span>
                          </td>
                          <td className="px-3 py-4">
                            <ChangeBadge pct={prev ? calcChange(revenue, prev.revenue) : null} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-semibold ${cogs > 0 ? "text-amber-400" : "text-slate-600"}`}>฿{fmt(cogs)}</span>
                          </td>
                          <td className="px-3 py-4">
                            <ChangeBadge pct={prev ? calcChange(cogs, prev.cogs) : null} invert />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-semibold ${gross >= 0 ? "text-blue-400" : "text-red-400"}`}>฿{fmt(gross)}</span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-semibold ${expenses > 0 ? "text-rose-400" : "text-slate-600"}`}>฿{fmt(expenses)}</span>
                          </td>
                          <td className="px-3 py-4">
                            <ChangeBadge pct={prev ? calcChange(expenses, prev.expenses) : null} invert />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`font-bold ${net >= 0 ? "text-purple-400" : "text-red-400"}`}>
                              {net >= 0 ? "+" : ""}฿{fmt(net)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            {revenue > 0
                              ? <span className={`text-xs font-semibold ${gross >= 0 ? "text-blue-400" : "text-red-400"}`}>{(gross / revenue * 100).toFixed(1)}%</span>
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {revenue > 0
                              ? <span className={`text-xs font-semibold ${net >= 0 ? "text-purple-400" : "text-red-400"}`}>{(net / revenue * 100).toFixed(1)}%</span>
                              : <span className="text-slate-600 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* P&L Table — YoY */}
        {showPnL && mode === "yoy" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div className="px-6 py-4 border-b border-white/5">
              <h2 className="text-white font-semibold text-sm">กำไร-ขาดทุน — Year over Year</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-600 text-sm">ไม่พบข้อมูล</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="px-5 py-3.5">เดือน</th>
                      {yoyData.years.flatMap((y) => [
                        <th key={`${y}-rev`} className="px-4 py-3.5 text-right">{y} รายได้</th>,
                        <th key={`${y}-net`} className="px-4 py-3.5 text-right">กำไรสุทธิ</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {yoyData.months.map((mm) => {
                      const hasData = yoyData.years.some((y) => yoyData.matrix[mm][y] !== null);
                      if (!hasData) return null;
                      return (
                        <tr key={mm} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3 text-slate-400 font-medium">{MM_TO_THAI[mm]}</td>
                          {yoyData.years.flatMap((y) => {
                            const cell = yoyData.matrix[mm][y];
                            return [
                              <td key={`${y}-rev`} className="px-4 py-3 text-right">
                                {cell ? <span className="text-emerald-400 font-semibold">฿{fmt(cell.revenue)}</span> : <span className="text-slate-700">—</span>}
                              </td>,
                              <td key={`${y}-net`} className="px-4 py-3 text-right">
                                {cell
                                  ? <span className={`font-bold ${cell.net >= 0 ? "text-purple-400" : "text-red-400"}`}>{cell.net >= 0 ? "+" : ""}฿{fmt(cell.net)}</span>
                                  : <span className="text-slate-700">—</span>}
                              </td>,
                            ];
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Detail panel */}
        {(showDetail || isDod) && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-slate-400/20 to-transparent" />

            {/* Detail header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <h2 className="text-white font-semibold text-sm">
                {isDod ? "รายการทั้งหมด (Day over Day)" :
                 isCompare ? `รายการ ช่วง A${cmpAStart ? ` ${cmpAStart}` : ""}${cmpAEnd ? ` – ${cmpAEnd}` : ""}` :
                 activePeriod ? `รายการ ${fmtPeriod(activePeriod)}` : "รายการ"}
              </h2>

              {/* Type filter badges */}
              <div className="flex gap-2 ml-auto flex-wrap">
                {(["revenue", "cogs", "expenses"] as ActiveType[]).map((t) => {
                  const m = TYPE_META[t];
                  const isActive = activeType === t;
                  const count = compareDetails[t].rows.length;
                  return (
                    <button
                      key={t}
                      onClick={() => setActiveType((prev) => prev === t ? null : t)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all border ${
                        isActive
                          ? `${m.cardBg} ${m.cardBorder} ${m.cardText}`
                          : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                      {m.label}
                      {count > 0 && <span className="opacity-60 text-[10px]">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail body */}
            {!showDetail && !isDod ? (
              <div className="px-6 py-10 text-center text-slate-600 text-sm">คลิกแถวในตารางด้านบนเพื่อดูรายการ</div>
            ) : activeType ? (
              renderTable(compareDetails[activeType])
            ) : isDod ? (
              renderDodView()
            ) : (
              renderMergedList()
            )}
          </div>
        )}

        {/* DoD hint when not yet loaded */}
        {isDod && !showDetail && (
          <div className="px-6 py-8 text-center text-slate-600 text-sm">กำลังโหลดรายการ...</div>
        )}
      </main>
    </div>
  );
}
