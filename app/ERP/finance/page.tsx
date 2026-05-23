"use client";

// TODO(DEV): ปัจจุบันหน้านี้คำนวณ real-time จาก HelperS/U/E ทุกครั้งที่โหลด
// ยิ่งข้อมูลเยอะ (helper rows มาก) ยิ่งช้า เพราะต้องอ่าน 4 sheets พร้อมกันทุก request
//
// แผนอนาคต: ทำ Auto Upload (background sync)
//   - เมื่อมีการบันทึกข้อมูลใหม่ (usage, sales, expense) → trigger sync ลง Finance sheet อัตโนมัติ
//   - Finance page อ่านจาก Finance sheet โดยตรง (1 sheet แทน 4) → เร็วขึ้นมาก
//   - ตัวเลือก: cron job รายชั่วโมง / webhook หลัง submit / on-demand refresh button
//   - ระวัง: ต้องป้องกัน duplicate insert (ใช้ period+branchId เป็น key เหมือนที่ทำไว้ใน POST /api/finance/sync)
//
// เหตุที่ยังไม่ทำ: ตอนนี้ข้อมูลยังน้อย ยังไม่ช้า รอ data เยอะขึ้นค่อย optimize

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ComputedRow {
  period: string;
  computed: { revenue: number; cogs: number; expenses: number };
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

export default function FinancePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";
  const sheetName     = searchParams.get("sheetName")     || "Finance";
  const moduleName    = searchParams.get("moduleName")    || "Financial Dashboard";

  const [role, setBranchRole]     = useState("");
  const [branchName, setBranchName] = useState("");
  const [branches, setBranches]   = useState<{ id: string; name: string }[]>([]);
  const [selBranch, setSelBranch] = useState("");

  const [rows, setRows]     = useState<ComputedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const loadData = useCallback(async (bid: string, bname: string) => {
    if (!spreadsheetId) return;
    setLoading(true);
    setError("");
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
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [spreadsheetId, sheetName]);

  useEffect(() => {
    async function init() {
      try {
        const auth = await fetch("/api/auth/branch-check").then((r) => r.json());
        setBranchRole(auth.role || "");
        setBranchName(auth.branchName || "");

        if (auth.role === "SUPER_ADMIN") {
          try {
            const bd   = await fetch("/api/auth/branches").then((r) => r.json());
            const list = (bd.branches || []).map((b: any) => ({ id: b.branchId, name: b.branchName }));
            setBranches([{ id: "", name: "ทั้งหมด" }, ...list]);
          } catch {
            setBranches([{ id: "", name: "ทั้งหมด" }]);
          }
          await loadData("", "");
        } else {
          setSelBranch(auth.branchId || "");
          setBranchName(auth.branchName || "");
          await loadData(auth.branchId || "", auth.branchName || "");
        }
      } catch (e: any) { setError(e.message); setLoading(false); }
    }
    init();
  }, [loadData]);

  async function handleBranchChange(bid: string) {
    setSelBranch(bid);
    const bname = bid ? (branches.find((b) => b.id === bid)?.name || "") : "";
    await loadData(bid, bname);
  }

  const isSA = role === "SUPER_ADMIN";

  const totalRevenue  = rows.reduce((s, r) => s + r.computed.revenue,  0);
  const totalCogs     = rows.reduce((s, r) => s + r.computed.cogs,     0);
  const totalExpenses = rows.reduce((s, r) => s + r.computed.expenses, 0);
  const totalGross    = totalRevenue - totalCogs;
  const totalNet      = totalGross - totalExpenses;

  const selBranchLabel = isSA
    ? (branches.find((b) => b.id === selBranch)?.name || "ทั้งหมด")
    : (branchName || "สาขา");

  const currentBname = selBranch
    ? (branches.find((b) => b.id === selBranch)?.name || "")
    : branchName || "";

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
          <p className="text-slate-500 text-xs">{selBranchLabel} · {rows.length} งวด</p>
        </div>
        <button onClick={() => loadData(selBranch, currentBname)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
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
                <button key={b.id || "__all__"} onClick={() => handleBranchChange(b.id)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${selBranch === b.id ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"}`}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "รายได้รวม",     value: totalRevenue,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "ต้นทุนขาย",     value: totalCogs,     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
            { label: "กำไรขั้นต้น",   value: totalGross,    color: totalGross >= 0 ? "text-blue-400" : "text-red-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { label: "ค่าใช้จ่ายรวม", value: totalExpenses, color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/20"    },
            { label: "กำไรสุทธิ",     value: totalNet,      color: totalNet >= 0 ? "text-purple-400" : "text-red-400", bg: totalNet >= 0 ? "bg-purple-500/10" : "bg-red-500/10", border: totalNet >= 0 ? "border-purple-500/20" : "border-red-500/20" },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`${bg} border ${border} rounded-2xl p-4`}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>฿{fmt(value)}</p>
            </div>
          ))}
        </div>

        {/* P&L Table */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-semibold text-sm">กำไร-ขาดทุนรายงวด</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center text-slate-600 text-sm">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="px-5 py-3.5">งวด</th>
                    <th className="px-5 py-3.5 text-right">รายได้รวม</th>
                    <th className="px-5 py-3.5 text-right">ต้นทุนขาย</th>
                    <th className="px-5 py-3.5 text-right">กำไรขั้นต้น</th>
                    <th className="px-5 py-3.5 text-right">ค่าใช้จ่ายรวม</th>
                    <th className="px-5 py-3.5 text-right">กำไรสุทธิ</th>
                    <th className="px-5 py-3.5 text-center">GM%</th>
                    <th className="px-5 py-3.5 text-center">NM%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { revenue, cogs, expenses } = row.computed;
                    const grossProfit = revenue - cogs;
                    const netProfit   = grossProfit - expenses;
                    const isProfit    = netProfit >= 0;
                    return (
                      <tr key={row.period} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-white font-medium">{fmtPeriod(row.period)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold ${revenue > 0 ? "text-emerald-400" : "text-slate-600"}`}>฿{fmt(revenue)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold ${cogs > 0 ? "text-amber-400" : "text-slate-600"}`}>฿{fmt(cogs)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold ${grossProfit >= 0 ? "text-blue-400" : "text-red-400"}`}>฿{fmt(grossProfit)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-semibold ${expenses > 0 ? "text-rose-400" : "text-slate-600"}`}>฿{fmt(expenses)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`font-bold text-base ${isProfit ? "text-purple-400" : "text-red-400"}`}>
                            {isProfit ? "+" : ""}฿{fmt(netProfit)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {revenue > 0
                            ? <span className={`text-xs font-semibold ${grossProfit >= 0 ? "text-blue-400" : "text-red-400"}`}>{(grossProfit / revenue * 100).toFixed(1)}%</span>
                            : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {revenue > 0
                            ? <span className={`text-xs font-semibold ${netProfit >= 0 ? "text-purple-400" : "text-red-400"}`}>{(netProfit / revenue * 100).toFixed(1)}%</span>
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
      </main>
    </div>
  );
}
