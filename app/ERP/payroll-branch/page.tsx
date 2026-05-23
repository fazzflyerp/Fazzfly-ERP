"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
interface CalcResult {
  nickname: string;
  fullName: string;
  position: string;
  baseSalary: number;
  type: "doctor" | "sales" | "bt" | "general";
  salesTotal: number;
  commission: number;
  df: number;
  nurseFee: number;
  sittingHours: number;
  sittingRate: number;
  sittingTotal: number;
  withholdTax: number;
  totalIn: number;
  totalDeduct: number;
  net: number;
  branchId?: string;
  branchName?: string;
  // ละเอียด
  salesPeriod?: string;
  dailyRate?: number;
  workDays?: number;
  leaveDays?: number;
  leaveRate?: number;
  leaveDeduct?: number;
  lateMin?: number;
  lateRate?: number;
  lateDeduct?: number;
  otMin?: number;
  otRate?: number;
  otBonus?: number;
  advance?: number;
  other?: number;
}

interface ManualEntry {
  leaveDays: string;
  lateMin: string;
  otMin: string;
  advance: string;
  other: string;
  sittingHours: string;
}

interface UserModule {
  moduleId: string;
  moduleName: string;
  spreadsheetId: string;
  sheetName: string;
}


function fmtNum(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function typeLabel(t: string): { label: string; color: string } {
  switch (t) {
    case "doctor":  return { label: "แพทย์",     color: "text-purple-400 bg-purple-500/10 border-purple-500/30" };
    case "sales":   return { label: "ขาย",       color: "text-green-400  bg-green-500/10  border-green-500/30"  };
    case "bt":      return { label: "BT/พยาบาล", color: "text-cyan-400   bg-cyan-500/10   border-cyan-500/30"   };
    default:        return { label: "ทั่วไป",     color: "text-slate-400  bg-slate-500/10  border-slate-500/30"  };
  }
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="relative w-5 h-5">
      <div className="absolute inset-0 rounded-full border-2 border-white/20" />
      <div className="absolute inset-0 rounded-full border-t-2 border-white animate-spin" />
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ emp, onClose }: { emp: CalcResult; onClose: () => void }) {
  const isDoc = emp.type === "doctor";
  const Row = ({ label, value, color = "text-slate-200", indent = false }: { label: string; value: string; color?: string; indent?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${indent ? "pl-3 border-l border-white/10" : ""}`}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-sm tabular-nums font-medium ${color}`}>{value}</span>
    </div>
  );
  const Sep = () => <div className="border-t border-white/[0.06] my-2" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 bg-white/[0.04] border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <p className="font-bold text-white">{emp.nickname} <span className="font-normal text-slate-400 text-sm">— {emp.fullName}</span></p>
            <p className="text-xs text-slate-500 mt-0.5">{emp.position} {emp.salesPeriod ? `• ยอดขายจาก ${emp.salesPeriod}` : ""}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-1 text-sm">

          {/* เงินเดือน */}
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">เงินเดือน</p>
          <Row label="เงินเดือนพื้นฐาน" value={fmtNum(emp.baseSalary)} color="text-white" />
          {(emp.dailyRate ?? 0) > 0 && <Row label="อัตราต่อวัน" value={fmtNum(emp.dailyRate!)} indent />}
          <Row label="วันทำงาน" value={`${emp.workDays ?? 26} วัน`} indent />

          <Sep />

          {/* รายได้พิเศษ */}
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">รายได้พิเศษ</p>
          {emp.salesTotal > 0 && <Row label="ยอดขาย" value={fmtNum(emp.salesTotal)} />}
          {emp.df > 0        && <Row label={`DF หมอ (${fmtNum(emp.salesTotal)} × ${emp.sittingRate}%)`} value={fmtNum(emp.df)} color="text-violet-400" />}
          {emp.commission > 0 && <Row label="ค่าคอม" value={fmtNum(emp.commission)} color="text-green-400" />}
          {emp.nurseFee > 0   && <Row label="ค่ามือ" value={fmtNum(emp.nurseFee)} color="text-cyan-400" />}
          {emp.sittingTotal > 0 && (
            <Row label={`ค่านั่ง (${emp.sittingHours} ชม. × ${fmtNum(emp.sittingRate)})`} value={fmtNum(emp.sittingTotal)} color="text-purple-400" />
          )}
          {(emp.otMin ?? 0) > 0 && (
            <>
              <Row label={`OT ${emp.otMin} นาที × ${fmtNum(emp.otRate ?? 0)}`} value={fmtNum(emp.otBonus ?? 0)} color="text-amber-400" />
            </>
          )}
          <div className="flex items-center justify-between py-1.5 bg-white/[0.03] rounded-lg px-2 mt-1">
            <span className="text-xs font-semibold text-slate-300">รวมรายรับ</span>
            <span className="text-sm font-bold text-white tabular-nums">{fmtNum(emp.totalIn)}</span>
          </div>

          <Sep />

          {/* รายการหัก */}
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">รายการหัก</p>
          {(emp.leaveDays ?? 0) > 0 && (
            <Row label={`ลา ${emp.leaveDays} วัน × ${fmtNum(emp.leaveRate ?? 0)}`} value={`−${fmtNum(emp.leaveDeduct ?? 0)}`} color="text-red-400" />
          )}
          {(emp.lateMin ?? 0) > 0 && (
            <Row label={`สาย ${emp.lateMin} นาที × ${fmtNum(emp.lateRate ?? 0)}`} value={`−${fmtNum(emp.lateDeduct ?? 0)}`} color="text-red-400" />
          )}
          {(emp.advance ?? 0) > 0 && <Row label="เบิกล่วงหน้า" value={`−${fmtNum(emp.advance!)}`} color="text-red-400" />}
          {emp.withholdTax > 0    && <Row label="หัก ณ ที่จ่าย" value={`−${fmtNum(emp.withholdTax)}`} color="text-red-400" />}
          {(emp.other ?? 0) > 0  && <Row label="หักอื่นๆ" value={`−${fmtNum(emp.other!)}`} color="text-red-400" />}
          {emp.totalDeduct === 0
            ? <p className="text-xs text-slate-600 py-1">ไม่มีรายการหัก</p>
            : (
              <div className="flex items-center justify-between py-1.5 bg-red-500/[0.06] rounded-lg px-2 mt-1">
                <span className="text-xs font-semibold text-slate-300">รวมหัก</span>
                <span className="text-sm font-bold text-red-400 tabular-nums">−{fmtNum(emp.totalDeduct)}</span>
              </div>
            )
          }

          <Sep />

          {/* ยอดสุทธิ */}
          <div className="flex items-center justify-between py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4">
            <span className="text-sm font-bold text-white">ยอดสุทธิ</span>
            <span className="text-xl font-bold text-emerald-400 tabular-nums">{fmtNum(emp.net)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Setup screen ─────────────────────────────────────────────────────────
function SetupScreen({ onSelect }: {
  onSelect: (hrId: string, salesId: string, salesSheet: string) => void
}) {
  const [modules,  setModules]  = useState<UserModule[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState("");
  const [manual,   setManual]   = useState("");  // paste spreadsheetId ตรงๆ

  useEffect(() => {
    fetch("/api/user/modules")
      .then((r) => r.json())
      .then((d) => setModules((d.modules || []).filter((m: UserModule) => m.spreadsheetId)))
      .finally(() => setLoading(false));
  }, []);

  const activeId = manual.trim() || selected;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-2xl"
            style={{ boxShadow: "0 8px 32px rgba(168,85,247,0.4)" }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">คำนวณเงินเดือน</h1>
          <p className="text-slate-400 text-sm mt-1">เลือกชีท HR Payroll</p>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-4">

          {/* Dropdown จาก modules */}
          {modules.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">เลือกจาก module</label>
              <select
                value={selected}
                onChange={(e) => { setSelected(e.target.value); setManual(""); }}
                className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all"
              >
                <option value="" className="bg-[#0f1629]">-- เลือกชีท --</option>
                {modules.map((m) => (
                  <option key={m.moduleId} value={m.spreadsheetId} className="bg-[#0f1629]">{m.moduleName}</option>
                ))}
              </select>
            </div>
          )}

          {/* หรือ paste ตรงๆ */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              หรือ paste Spreadsheet ID ตรงๆ
            </label>
            <input
              type="text"
              value={manual}
              onChange={(e) => { setManual(e.target.value); setSelected(""); }}
              placeholder="1CizCZd_SJaFPTPEA5..."
              className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all font-mono placeholder:text-slate-600"
            />
            <p className="text-xs text-slate-600 mt-1">เอาจาก URL: docs.google.com/spreadsheets/d/<span className="text-slate-400">ID</span>/edit</p>
          </div>

          {/* Required tabs */}
          <div className="flex flex-wrap gap-2 pt-1">
            {["Helper_EMP", "Payroll_Transaction", "Helper"].map((s) => (
              <span key={s} className="px-2.5 py-1 text-xs text-slate-400 bg-white/[0.04] border border-white/10 rounded-lg font-mono">{s}</span>
            ))}
          </div>

          <button
            onClick={() => activeId && onSelect(activeId, activeId, "Helper")}
            disabled={!activeId}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl hover:from-purple-600 hover:to-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            ไปหน้าคำนวณ →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Content ───────────────────────────────────────────────────────────
function PayrollBranchContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSheetId,      setActiveSheetId]      = useState(searchParams.get("spreadsheetId") || "");
  const [activeSalesSheetId, setActiveSalesSheetId] = useState(searchParams.get("salesSpreadsheetId") || searchParams.get("spreadsheetId") || "");
  const [activeSalesSheet,   setActiveSalesSheet]   = useState(searchParams.get("salesSheetName") || "Helper");
  const [setupDone,          setSetupDone]          = useState(!!searchParams.get("spreadsheetId"));

  const [branchId,    setBranchId]    = useState<string | null>(null);
  const [branchName,  setBranchName]  = useState<string | null>(null);
  const [isCentral,   setIsCentral]   = useState(false);
  const [allBranches, setAllBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<{ branchId: string; branchName: string } | null>(null);
  const [userRole,    setUserRole]    = useState<string>("");

  const [periodOptions, setPeriodOptions] = useState<string[]>([]);
  const [period,        setPeriod]        = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [results, setResults] = useState<CalcResult[] | null>(null);
  const [salesRef, setSalesRef] = useState("");
  const [manual,  setManual]  = useState<Record<string, ManualEntry>>({});
  const [saving,     setSaving]     = useState(false);
  const [activeTab,  setActiveTab]  = useState<"calc" | "summary">("calc");
  const [selectedEmp, setSelectedEmp] = useState<CalcResult | null>(null);

  // โหลด period options จาก Helper sheet
  useEffect(() => {
    if (!activeSheetId) return;
    fetch(`/api/payroll/periods?spreadsheetId=${activeSheetId}&sheetName=${activeSalesSheet}`)
      .then((r) => r.json())
      .then((d) => {
        const opts: string[] = d.periods || [];
        setPeriodOptions(opts);
        if (opts.length > 0) setPeriod((prev) => prev || opts[0]);
      });
  }, [activeSheetId, activeSalesSheet]);

  // auth
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/auth/branch-check")
      .then((r) => r.json())
      .then((data) => {
        const bid = (data.branchId || "").toString().trim().toLowerCase();
        setBranchId(bid);
        setBranchName(data.branchName || bid);
        setUserRole((data.role || "").toString().trim().toUpperCase());
        if (bid === "central") {
          setIsCentral(true);
          fetch("/api/auth/branches").then((r) => r.json()).then((d) => setAllBranches(d.branches || []));
        }
      });
  }, [status]);

  // null = ทุกสาขา (central เท่านั้น), object = สาขาเดียว
  const [showAllBranches, setShowAllBranches] = useState(false);
  const effectiveBranch = isCentral
    ? (showAllBranches ? null : selectedBranch)
    : branchId ? { branchId, branchName: branchName || branchId } : null;
  const canCalc = !isCentral || showAllBranches || !!selectedBranch;

  // setup callback
  const handleSetup = useCallback((hrId: string, salesId: string, sname: string) => {
    setActiveSheetId(hrId);
    setActiveSalesSheetId(salesId);
    setActiveSalesSheet(sname);
    setSetupDone(true);
  }, []);

  // ── calculate ────────────────────────────────────────────────────────────
  const callOneBranch = useCallback(async (
    branch: { branchId: string; branchName: string },
    calcMode: "init" | "recalc",
    manualOverrides?: Record<string, any>
  ) => {
    const body: any = {
      spreadsheetId:      activeSheetId,
      salesSpreadsheetId: activeSalesSheetId,
      salesSheetName:     activeSalesSheet,
      period,
      branchId:           branch.branchId,
      salesBranchName:    branch.branchName,
      mode:               calcMode,
    };
    if (manualOverrides) body.manualOverrides = manualOverrides;
    const res  = await fetch("/api/payroll/calc-branch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const tagged = (data.results || []).map((r: CalcResult) => ({ ...r, branchId: branch.branchId, branchName: branch.branchName }));
    return { results: tagged as CalcResult[], salesPeriod: data.salesPeriod as string };
  }, [activeSheetId, activeSalesSheetId, activeSalesSheet, period]);

  const runCalc = useCallback(async (calcMode: "init" | "recalc", manualOverrides?: Record<string, any>) => {
    if (!activeSheetId || !canCalc) { setError("กรุณาเลือกสาขาก่อน"); return; }
    calcMode === "recalc" ? setSaving(true) : setLoading(true);
    setError(null);
    try {
      let allResults: CalcResult[] = [];
      let salesPeriodRef = "";

      if (showAllBranches && isCentral && allBranches.length > 0) {
        const responses = await Promise.all(allBranches.map((b) => callOneBranch(b, calcMode, manualOverrides)));
        responses.forEach(({ results: r, salesPeriod }) => { allResults = [...allResults, ...r]; salesPeriodRef = salesPeriod; });
      } else if (effectiveBranch) {
        const { results: r, salesPeriod } = await callOneBranch(effectiveBranch, calcMode, manualOverrides);
        allResults = r; salesPeriodRef = salesPeriod;
      }

      setResults(allResults);
      setSalesRef(salesPeriodRef || "");

      if (calcMode === "init") {
        const m: Record<string, ManualEntry> = {};
        allResults.forEach((r) => { m[r.nickname] = { leaveDays: "0", lateMin: "0", otMin: "0", advance: "0", other: "0", sittingHours: "0" }; });
        setManual(m);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }, [activeSheetId, activeSalesSheetId, activeSalesSheet, period, effectiveBranch, showAllBranches, isCentral, allBranches, canCalc, callOneBranch]);

  const handleRecalc = useCallback(() => {
    const overrides: Record<string, any> = {};
    Object.entries(manual).forEach(([nick, m]) => {
      overrides[nick] = {
        leaveDays:    parseFloat(m.leaveDays)    || 0,
        lateMin:      parseFloat(m.lateMin)      || 0,
        otMin:        parseFloat(m.otMin)        || 0,
        advance:      parseFloat(m.advance)      || 0,
        other:        parseFloat(m.other)        || 0,
        sittingHours: parseFloat(m.sittingHours) || 0,
      };
    });
    runCalc("recalc", overrides);
  }, [manual, runCalc]);

  const updateManual = (nick: string, field: keyof ManualEntry, val: string) =>
    setManual((prev) => ({ ...prev, [nick]: { ...(prev[nick] || {}), [field]: val } }));

  // ── loading / setup screens ───────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <Spinner />
      </div>
    );
  }

  if (!setupDone) {
    return <SetupScreen onSelect={handleSetup} />;
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (<>
    {selectedEmp && <DetailModal emp={selectedEmp} onClose={() => setSelectedEmp(null)} />}
    <div className="min-h-screen bg-[#0a0f1e] pb-16">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.push("/ERP/home-demo")}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">HR</div>
            <h1 className="text-lg sm:text-xl font-bold text-white">คำนวณเงินเดือนประจำเดือน</h1>
            {activeSheetId && (
              <div className="ml-auto flex items-center gap-2">
                {userRole === "SUPER_ADMIN" && (
                  <Link
                    href={`/ERP/commission-config?spreadsheetId=${activeSheetId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-300 bg-green-500/10 border border-green-500/25 rounded-xl hover:bg-green-500/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    ค่าคอม
                  </Link>
                )}
              </div>
            )}
          </div>
          {effectiveBranch && (
            <p className="text-slate-400 text-sm pl-20">สาขา: {effectiveBranch.branchName}</p>
          )}
        </div>

        {/* Config card */}
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-5">
          <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.03] border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-purple-500 rounded-full" />
              <h2 className="text-sm font-bold text-white">ตั้งค่าการคำนวณ</h2>
            </div>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Period */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">งวดเดือน</label>
              <select
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setResults(null); }}
                disabled={periodOptions.length === 0}
                className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all disabled:opacity-50"
              >
                {periodOptions.length === 0
                  ? <option className="bg-[#0f1629]">กำลังโหลด...</option>
                  : periodOptions.map((p) => (
                      <option key={p} value={p} className="bg-[#0f1629]">{p}</option>
                    ))
                }
              </select>
            </div>

            {/* Branch — central only */}
            {isCentral && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">สาขา</label>
                <select
                  value={showAllBranches ? "all" : (selectedBranch?.branchId || "")}
                  onChange={(e) => {
                    if (e.target.value === "all") { setShowAllBranches(true); setSelectedBranch(null); }
                    else { setShowAllBranches(false); setSelectedBranch(allBranches.find((x) => x.branchId === e.target.value) || null); }
                    setResults(null);
                  }}
                  className="w-full px-3 py-2.5 text-sm text-white bg-white/[0.06] border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/60 transition-all"
                >
                  <option value="" className="bg-[#0f1629]">-- เลือกสาขา --</option>
                  <option value="all" className="bg-[#0f1629]">ทุกสาขา</option>
                  {allBranches.map((b) => (
                    <option key={b.branchId} value={b.branchId} className="bg-[#0f1629]">{b.branchName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 sm:px-6 sm:pb-5 flex items-center gap-3">
            <button
              onClick={() => runCalc("init")}
              disabled={loading || !canCalc}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? <><Spinner /> กำลังคำนวณ...</> : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  คำนวณต้นเดือน
                </>
              )}
            </button>
            {salesRef && (
              <p className="text-xs text-slate-500">
                อ้างอิงยอดขาย: <span className="text-purple-400 font-medium">{salesRef}</span>
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <>
            {/* Results card with tabs */}
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-5">

              {/* Header + tabs */}
              <div className="px-4 sm:px-6 pt-4 pb-0 bg-white/[0.03] border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-green-500 rounded-full" />
                    <h2 className="text-sm font-bold text-white">ผลการคำนวณ — {period}</h2>
                  </div>
                  <span className="text-xs text-slate-400">{results.length} คน</span>
                </div>
                <div className="flex gap-1">
                  {(["calc", "summary"] as const).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                        activeTab === tab
                          ? "bg-white/[0.08] text-white border-t border-x border-white/10"
                          : "text-slate-500 hover:text-slate-300"
                      }`}>
                      {tab === "calc" ? "ผลการคำนวณ" : "สรุปรายได้"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Position chips */}
              <div className="px-4 py-3 sm:px-6 flex flex-wrap gap-2 border-b border-white/5">
                {Array.from(
                  results.reduce((map, r) => {
                    const pos = r.position || "ไม่ระบุ";
                    map.set(pos, { count: (map.get(pos)?.count || 0) + 1, type: r.type });
                    return map;
                  }, new Map<string, { count: number; type: string }>())
                ).map(([pos, { count, type }]) => {
                  const { color } = typeLabel(type);
                  return (
                    <span key={pos} className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${color}`}>
                      {pos} {count} คน
                    </span>
                  );
                })}
              </div>

              {/* Tab: ผลการคำนวณ */}
              {activeTab === "calc" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-white/5">
                        <th className="text-left px-4 py-3 sm:px-6 font-medium">ชื่อเล่น</th>
                        {showAllBranches && <th className="text-left px-3 py-3 font-medium">สาขา</th>}
                        <th className="text-left px-3 py-3 font-medium">ตำแหน่ง</th>
                        <th className="text-right px-3 py-3 font-medium">เงินเดือน</th>
                        <th className="text-right px-3 py-3 font-medium">ยอดขาย</th>
                        <th className="text-right px-3 py-3 font-medium">DF หมอ</th>
                        <th className="text-right px-3 py-3 font-medium">ค่าคอม</th>
                        <th className="text-right px-3 py-3 font-medium">ค่ามือ</th>
                        <th className="text-right px-4 py-3 sm:px-6 font-medium">หัก ณ ที่จ่าย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {results.map((r) => {
                        const { label, color } = typeLabel(r.type);
                        return (
                          <tr key={r.nickname} onClick={() => setSelectedEmp(r)} className="hover:bg-white/[0.04] cursor-pointer transition-colors">
                            <td className="px-4 py-3 sm:px-6">
                              <div className="font-medium text-white">{r.nickname}</div>
                              <div className="text-xs text-slate-500">{r.fullName}</div>
                            </td>
                            {showAllBranches && (
                              <td className="px-3 py-3">
                                <span className="px-2 py-0.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/25 rounded-md">{r.branchName || r.branchId}</span>
                              </td>
                            )}
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-md border ${color}`}>{r.position || label}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-slate-300 tabular-nums">{r.baseSalary > 0 ? fmtNum(r.baseSalary) : "—"}</td>
                            <td className="px-3 py-3 text-right text-slate-300 tabular-nums">{r.salesTotal > 0 ? fmtNum(r.salesTotal) : "—"}</td>
                            <td className="px-3 py-3 text-right text-violet-400 tabular-nums">{(r.df ?? 0) > 0 ? fmtNum(r.df) : "—"}</td>
                            <td className="px-3 py-3 text-right text-green-400  tabular-nums">{r.commission > 0 ? fmtNum(r.commission) : "—"}</td>
                            <td className="px-3 py-3 text-right text-cyan-400   tabular-nums">{r.nurseFee   > 0 ? fmtNum(r.nurseFee)   : "—"}</td>
                            <td className="px-4 py-3 sm:px-6 text-right text-red-400 tabular-nums">{r.withholdTax > 0 ? fmtNum(r.withholdTax) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab: สรุปรายได้ */}
              {activeTab === "summary" && (
                <div className="p-4 sm:p-6 space-y-4">
                  {results.map((r) => {
                    const { color } = typeLabel(r.type);
                    const incomeRows = [
                      { label: "เงินเดือน",  value: r.baseSalary,   c: "text-slate-300"  },
                      r.commission  > 0 ? { label: "ค่าคอม",   value: r.commission,   c: "text-green-400"  } : null,
                      (r.df ?? 0)   > 0 ? { label: "DF หมอ",   value: r.df,           c: "text-violet-400" } : null,
                      r.nurseFee    > 0 ? { label: "ค่ามือ",   value: r.nurseFee,     c: "text-cyan-400"   } : null,
                      r.sittingTotal > 0 ? { label: "ค่านั่ง", value: r.sittingTotal, c: "text-purple-400" } : null,
                    ].filter(Boolean) as { label: string; value: number; c: string }[];
                    const deductRows = [
                      r.withholdTax > 0 ? { label: "หัก ณ ที่จ่าย", value: r.withholdTax } : null,
                      (r.totalDeduct - r.withholdTax) > 0 ? { label: "หักอื่นๆ", value: r.totalDeduct - r.withholdTax } : null,
                    ].filter(Boolean) as { label: string; value: number }[];
                    return (
                      <div key={r.nickname} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="font-semibold text-white">{r.nickname}</span>
                          <span className="text-xs text-slate-500">{r.fullName}</span>
                          <span className={`ml-auto px-2 py-0.5 text-xs rounded-md border ${color}`}>{r.position}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">รายรับ</p>
                            <div className="space-y-1.5">
                              {incomeRows.map(({ label, value, c }) => (
                                <div key={label} className="flex items-center justify-between">
                                  <span className="text-xs text-slate-400">{label}</span>
                                  <span className={`text-sm font-medium tabular-nums ${c}`}>{fmtNum(value)}</span>
                                </div>
                              ))}
                              <div className="border-t border-white/10 pt-1.5 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300">รวมรายรับ</span>
                                <span className="text-sm font-bold text-white tabular-nums">{fmtNum(r.totalIn)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">รายหัก</p>
                            <div className="space-y-1.5">
                              {deductRows.length === 0
                                ? <p className="text-xs text-slate-600">ไม่มีรายการหัก</p>
                                : deductRows.map(({ label, value }) => (
                                  <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">{label}</span>
                                    <span className="text-sm font-medium text-red-400 tabular-nums">−{fmtNum(value)}</span>
                                  </div>
                                ))
                              }
                              <div className="border-t border-white/10 pt-1.5 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-300">รวมหัก</span>
                                <span className="text-sm font-bold text-red-400 tabular-nums">−{fmtNum(r.totalDeduct)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                          <span className="text-sm font-bold text-white">ยอดสุทธิ</span>
                          <span className="text-lg font-bold text-emerald-400 tabular-nums">{fmtNum(r.net)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">รวมสุทธิทั้งหมด</span>
                    <span className="text-xl font-bold text-emerald-400 tabular-nums">{fmtNum(results.reduce((s, r) => s + r.net, 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-5">
              <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.03] border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-amber-500 rounded-full" />
                  <h2 className="text-sm font-bold text-white">กรอก Manual</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 pl-3">สาย / OT / ลา / เบิกล่วงหน้า — แล้วกด "คำนวณใหม่"</p>
              </div>

              <div className="p-4 sm:p-6 space-y-3">
                {results.map((r) => (
                  <div key={r.nickname} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-semibold text-white text-sm">{r.nickname}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-md border ${typeLabel(r.type).color}`}>
                        {r.position || typeLabel(r.type).label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {([
                        { key: "leaveDays", label: "ลา (วัน)"     },
                        { key: "lateMin",   label: "สาย (นาที)"   },
                        { key: "otMin",     label: "OT (นาที)"    },
                        { key: "advance",   label: "เบิกล่วงหน้า" },
                        { key: "other",     label: "หักอื่นๆ"     },
                      ] as const).map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs text-slate-400 mb-1">{label}</label>
                          <input
                            type="number"
                            min="0"
                            value={manual[r.nickname]?.[key] ?? "0"}
                            onChange={(e) => updateManual(r.nickname, key, e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white bg-white/[0.06] border border-white/10 rounded-lg focus:outline-none focus:border-amber-500/60 transition-all tabular-nums"
                          />
                        </div>
                      ))}
                      {r.type === "doctor" && (
                        <div>
                          <label className="block text-xs text-purple-400 mb-1">นั่ง (ชม.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={manual[r.nickname]?.sittingHours ?? "0"}
                            onChange={(e) => updateManual(r.nickname, "sittingHours", e.target.value)}
                            className="w-full px-3 py-2 text-sm text-purple-300 bg-purple-500/5 border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-500/60 transition-all tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-5 sm:px-6 border-t border-white/5 pt-4">
                <button
                  onClick={handleRecalc}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? <><Spinner /> กำลังบันทึก...</> : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      คำนวณใหม่ + บันทึก
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-500 mt-2">ยอดขาย/ค่าคอม/ค่ามือยังคงเดิม — คำนวณใหม่จาก manual ที่กรอก</p>
              </div>
            </div>
          </>
        )}

        {results && results.length === 0 && (
          <div className="bg-white/[0.04] rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-slate-400 text-sm">ไม่พบพนักงาน active ในสาขานี้</p>
            <p className="text-slate-600 text-xs mt-1">ตรวจสอบ Helper_EMP ว่า col M = "A" และ col P = branch_id ถูกต้อง</p>
          </div>
        )}
      </div>
    </div>
  </>);
}

// ── Page wrapper ───────────────────────────────────────────────────────────
export default function PayrollBranchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin" />
        </div>
      </div>
    }>
      <PayrollBranchContent />
    </Suspense>
  );
}
