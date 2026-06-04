"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

// ── Types ────────────────────────────────────────────────────────────────────
interface Liability {
  liability_id: string; po_id: string; supplier_name: string;
  installment_no: string; due_date: string; amount: string;
  paid_date: string; status: string; note: string; created_at: string;
}
// AR จาก AR module (AR_Debts) — ไม่ใช่ HelperS
interface DebtItem {
  debt_id: string;
  customer_name: string;
  customer_phone: string;
  debt_type: "installment" | "credit";
  total_amount: number;
  paid_amount: number;
  remaining: number;
  installment_count: number;
  pending_count: number;
  first_due_date: string;
  next_due_date: string | null;
  next_due_amount: number | null;
  source_ref: string;
  branch_name: string;
  status: "active" | "overdue" | "settled";
}
interface ARSummary {
  total: number; count: number; overdue: number;
  aging: Record<string, number>;
}
type Tab = "dashboard" | "ar" | "ap";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => Math.abs(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });

function parseDueDate(s: string): Date | null {
  if (!s) return null;
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1]);
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.slice(0,10));
  return null;
}
function isOverdue(due: string): boolean {
  const d = parseDueDate(due);
  return !!d && d < new Date();
}
function daysUntil(due: string): number | null {
  const d = parseDueDate(due);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
function fmtDueDate(s: string): string {
  const d = parseDueDate(s);
  if (!d) return s;
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
}

const AGING_LABELS: Record<string, { label: string; cls: string }> = {
  "current": { label: "ปัจจุบัน",  cls: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  "1-30":    { label: "1–30 วัน",  cls: "text-amber-400  bg-amber-500/10  border-amber-500/20"  },
  "31-60":   { label: "31–60 วัน", cls: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  "61+":     { label: "60+ วัน",   cls: "text-red-400    bg-red-500/10    border-red-500/20"    },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-600">{sub}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountingDemoPage() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const spreadsheetId = searchParams.get("spreadsheetId") || "";

  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  // AR (จาก AR module — AR_Debts)
  const [arItems, setArItems] = useState<DebtItem[]>([]);
  const [arSummary, setArSummary] = useState<ARSummary | null>(null);
  const [arLoading, setArLoading] = useState(true);
  const [arQ, setArQ] = useState("");

  // AP
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [apLoading, setApLoading] = useState(true);
  const [apFilter, setApFilter] = useState<"PENDING" | "PAID" | "ALL">("PENDING");

  // Pay modal
  const [payModal, setPayModal] = useState<Liability | null>(null);
  const [payForm, setPayForm] = useState({ paid_date: "", note: "" });
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // ── Load AR — อ่านจาก AR module (AR_Debts) ───────────────────────────────
  const loadAR = useCallback(() => {
    setArLoading(true);
    fetch("/api/ar/debts")
      .then((r) => r.json())
      .then((d) => {
        const debts: DebtItem[] = (d.debts || []).filter(
          (debt: DebtItem) => debt.status !== "settled"
        );
        setArItems(debts);

        // คำนวณ summary
        const total   = debts.reduce((s, x) => s + x.remaining, 0);
        const overdue = debts.filter((x) => x.status === "overdue").length;
        const aging: Record<string, number> = { "current": 0, "1-30": 0, "31-60": 0, "61+": 0 };
        const today   = Date.now();
        debts.forEach((debt) => {
          let bucket = "current";
          if (debt.status === "overdue") {
            const refDate = parseDueDate(debt.next_due_date || debt.first_due_date);
            if (refDate) {
              const days = Math.floor((today - refDate.getTime()) / 86400000);
              if (days <= 30)      bucket = "1-30";
              else if (days <= 60) bucket = "31-60";
              else                 bucket = "61+";
            } else {
              bucket = "1-30";
            }
          }
          aging[bucket] = (aging[bucket] || 0) + debt.remaining;
        });
        setArSummary({ total: Math.round(total * 100) / 100, count: debts.length, overdue, aging });
      })
      .catch(() => {})
      .finally(() => setArLoading(false));
  }, []);

  useEffect(() => { loadAR(); }, [loadAR]);

  // ── Load AP (Liabilities) ─────────────────────────────────────────────────
  const loadAP = useCallback(() => {
    setApLoading(true);
    fetch("/api/inv/liabilities")
      .then((r) => r.json())
      .then((d) => setLiabilities(d.liabilities || []))
      .catch(() => {})
      .finally(() => setApLoading(false));
  }, []);

  useEffect(() => { loadAP(); }, [loadAP]);

  // ── Pay AP ────────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!payModal) return;
    setPaying(true); setPayMsg("");
    try {
      const res = await fetch("/api/inv/liabilities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liability_id: payModal.liability_id, ...payForm }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setPayMsg("✓ บันทึกการชำระเรียบร้อย");
      loadAP();
      setTimeout(() => { setPayModal(null); setPayMsg(""); }, 1500);
    } catch (e: any) {
      setPayMsg("✗ " + e.message);
    } finally {
      setPaying(false);
    }
  };

  // ── Derived AP values ─────────────────────────────────────────────────────
  const pendingLia = liabilities.filter((l) => l.status === "PENDING");
  const totalAP = pendingLia.reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
  const overdueAP = pendingLia.filter((l) => isOverdue(l.due_date));
  const filteredLia = apFilter === "ALL" ? liabilities
    : liabilities.filter((l) => l.status === apFilter);

  // ── AR filtered ───────────────────────────────────────────────────────────
  const filteredAR = arItems.filter((d) => {
    if (!arQ) return true;
    const q = arQ.toLowerCase();
    return (
      d.customer_name.toLowerCase().includes(q) ||
      (d.customer_phone || "").includes(q) ||
      (d.source_ref || "").toLowerCase().includes(q) ||
      (d.branch_name || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    // overdue ขึ้นก่อน แล้วเรียงตาม remaining มากสุด
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (b.status === "overdue" && a.status !== "overdue") return 1;
    return b.remaining - a.remaining;
  });

  const baseInput = "w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors";

  if (status === "loading") return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/5 rounded-full blur-[100px]" />
      </div>

      {/* Top Bar */}
      <div className="relative z-20 sticky top-0 bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
              <button onClick={() => router.back()} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <span className="font-bold text-sm text-white">บัญชี</span>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1">
              {([
                ["dashboard", "Dashboard"],
                ["ar",        "ลูกหนี้"],
                ["ap",        "เจ้าหนี้"],
              ] as [Tab, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    tab === key ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                  }`}>
                  {label}
                  {key === "ar"  && arSummary && arSummary.count > 0 && (
                    <span className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{arSummary.count}</span>
                  )}
                  {key === "ap"  && overdueAP.length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{overdueAP.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── DASHBOARD TAB ─────────────────────────────────────────── */}
        {tab === "dashboard" && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="ลูกหนี้ค้างชำระ" color="bg-orange-500/[0.07] border-orange-500/15"
                value={arLoading ? "…" : `฿${fmt(arSummary?.total ?? 0)}`}
                sub={arSummary ? `${arSummary.count} รายการ${arSummary.overdue > 0 ? ` · เกินกำหนด ${arSummary.overdue}` : ""}` : undefined}
                icon={<svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>}
              />
              <KpiCard label="หนี้สินค้างชำระ" color="bg-violet-500/[0.07] border-violet-500/15"
                value={apLoading ? "…" : `฿${fmt(totalAP)}`}
                sub={`${pendingLia.length} งวด${overdueAP.length > 0 ? ` · เกินกำหนด ${overdueAP.length}` : ""}`}
                icon={<svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* AR Aging Summary */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">AR Aging</h3>
                  <button onClick={() => setTab("ar")} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">ดูทั้งหมด →</button>
                </div>
                {arLoading ? (
                  <div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin"/></div>
                ) : arSummary && arSummary.total > 0 ? (
                  <div className="p-4 space-y-2.5">
                    {Object.entries(AGING_LABELS).map(([key, { label, cls }]) => {
                      const amt = arSummary.aging[key] || 0;
                      const pct = arSummary.total > 0 ? (amt / arSummary.total) * 100 : 0;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`}>{label}</span>
                            <span className="text-slate-300 font-semibold">฿{fmt(amt)}</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-600 text-xs">ไม่มีลูกหนี้ค้างชำระ 🎉</div>
                )}
              </div>

              {/* AP Upcoming */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">เจ้าหนี้ใกล้ครบกำหนด</h3>
                  <button onClick={() => setTab("ap")} className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">ดูทั้งหมด →</button>
                </div>
                {apLoading ? (
                  <div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin"/></div>
                ) : pendingLia.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">ไม่มีเจ้าหนี้ค้างจ่าย 🎉</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {[...pendingLia]
                      .sort((a, b) => (parseDueDate(a.due_date)?.getTime() ?? 0) - (parseDueDate(b.due_date)?.getTime() ?? 0))
                      .slice(0, 6)
                      .map((l) => {
                        const days = daysUntil(l.due_date);
                        const over = isOverdue(l.due_date);
                        return (
                          <div key={l.liability_id} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                            <div>
                              <p className="text-xs font-semibold text-white">{l.supplier_name}</p>
                              <p className="text-[11px] text-slate-500">งวด {l.installment_no} · {fmtDueDate(l.due_date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-white">฿{fmt(parseFloat(l.amount || "0"))}</p>
                              {days !== null && (
                                <p className={`text-[10px] font-semibold ${over ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-slate-500"}`}>
                                  {over ? `เกิน ${Math.abs(days)} วัน` : days === 0 ? "วันนี้" : `อีก ${days} วัน`}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

          </>
        )}

        {/* ── AR TAB ────────────────────────────────────────────────── */}
        {tab === "ar" && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">ลูกหนี้การค้า (AR)</h2>
                {arSummary && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ค้างชำระรวม ฿{fmt(arSummary.total)} · {arSummary.count} ราย
                    {arSummary.overdue > 0 && (
                      <span className="text-red-400 ml-1.5">· ⚠ เกินกำหนด {arSummary.overdue} ราย</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input value={arQ} onChange={(e) => setArQ(e.target.value)} placeholder="ค้นหาลูกค้า…"
                    className="w-full pl-8 pr-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"/>
                </div>
                <button
                  onClick={() => router.push("/ERP/ar")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-xs font-medium transition-all whitespace-nowrap"
                  title="ไปหน้าจัดการลูกหนี้">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span className="hidden sm:inline">จัดการลูกหนี้</span>
                  <svg className="w-3 h-3 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Summary chips */}
            {arSummary && arSummary.total > 0 && (
              <div className="flex gap-2 px-5 py-3 border-b border-white/[0.04] flex-wrap">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20">
                  ค้างทั้งหมด · ฿{fmt(arSummary.total)}
                </span>
                {arSummary.overdue > 0 && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border text-red-400 bg-red-500/10 border-red-500/20">
                    ⚠ เกินกำหนด {arSummary.overdue} ราย
                  </span>
                )}
                {Object.entries(AGING_LABELS).map(([key, { label, cls }]) => {
                  const amt = arSummary.aging[key] || 0;
                  if (!amt || key === "current") return null;
                  return (
                    <span key={key} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
                      {label} · ฿{fmt(amt)}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Table header */}
            <div className="grid grid-cols-[1fr_90px_90px_100px_80px] px-5 py-2 border-b border-white/[0.05] bg-white/[0.02]">
              {["ลูกค้า / ที่มา","ยอดรวม","ชำระแล้ว","คงเหลือ","สถานะ"].map((h, i) => (
                <p key={h} className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wide ${i === 0 ? "" : "text-right"}`}>{h}</p>
              ))}
            </div>

            {arLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin"/>
              </div>
            ) : filteredAR.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-slate-600">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-sm">{arQ ? "ไม่พบลูกค้า" : "ไม่มีลูกหนี้ค้างชำระ 🎉"}</p>
                {!arQ && (
                  <button onClick={() => router.push("/ERP/ar")}
                    className="mt-2 text-xs text-blue-400 hover:underline">
                    + เพิ่มรายการลูกหนี้
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {filteredAR.map((debt) => {
                  const isOverdueDebt = debt.status === "overdue";
                  const pct = debt.total_amount > 0
                    ? Math.min(100, Math.round((debt.paid_amount / debt.total_amount) * 100))
                    : 0;
                  return (
                    <div key={debt.debt_id}
                      className="grid grid-cols-[1fr_90px_90px_100px_80px] px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
                      {/* ลูกค้า */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">{debt.customer_name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            debt.debt_type === "installment"
                              ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}>
                            {debt.debt_type === "installment"
                              ? `ผ่อน ${debt.pending_count}/${debt.installment_count} งวด`
                              : "ค้างจ่าย"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {debt.source_ref && (
                            <span className="text-[10px] text-slate-600 truncate max-w-[200px]">{debt.source_ref}</span>
                          )}
                          {debt.branch_name && (
                            <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded">📍{debt.branch_name}</span>
                          )}
                        </div>
                        {/* Progress bar */}
                        {pct > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 max-w-[180px]">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isOverdueDebt ? "bg-red-400" : "bg-blue-400"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[9px] text-slate-600 shrink-0">{pct}%</span>
                          </div>
                        )}
                      </div>
                      {/* ยอดรวม */}
                      <p className="text-xs text-slate-400 text-right">฿{fmt(debt.total_amount)}</p>
                      {/* ชำระแล้ว */}
                      <p className="text-xs text-emerald-500 text-right">
                        {debt.paid_amount > 0 ? `฿${fmt(debt.paid_amount)}` : "—"}
                      </p>
                      {/* คงเหลือ */}
                      <p className={`text-sm font-bold text-right ${isOverdueDebt ? "text-red-400" : "text-amber-400"}`}>
                        ฿{fmt(debt.remaining)}
                      </p>
                      {/* สถานะ */}
                      <div className="flex justify-end">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          isOverdueDebt
                            ? "text-red-400 bg-red-500/10 border-red-500/20"
                            : "text-blue-400 bg-blue-500/10 border-blue-500/20"
                        }`}>
                          {isOverdueDebt ? "⚠ เกิน" : "ค้างอยู่"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AP TAB ────────────────────────────────────────────────── */}
        {tab === "ap" && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">เจ้าหนี้การค้า (AP)</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ค้างจ่าย ฿{fmt(totalAP)} · {pendingLia.length} งวด
                  {overdueAP.length > 0 && <span className="text-red-400 ml-2">เกินกำหนด {overdueAP.length} งวด</span>}
                </p>
              </div>
              {/* Filter */}
              <div className="flex gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-xl p-1">
                {(["PENDING","PAID","ALL"] as const).map((f) => (
                  <button key={f} onClick={() => setApFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      apFilter === f ? "bg-violet-500 text-white" : "text-slate-400 hover:text-white"
                    }`}>
                    {f === "PENDING" ? "ค้างจ่าย" : f === "PAID" ? "จ่ายแล้ว" : "ทั้งหมด"}
                    <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full ${apFilter === f ? "bg-white/20" : "bg-white/[0.08]"}`}>
                      {f === "ALL" ? liabilities.length : liabilities.filter((l) => l.status === f).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_110px_110px_90px_80px] px-5 py-2 border-b border-white/[0.05] bg-white/[0.02]">
              {["Supplier","งวด","ครบกำหนด","จำนวนเงิน","สถานะ",""].map((h, i) => (
                <p key={i} className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wide ${i > 1 ? "text-right" : ""}`}>{h}</p>
              ))}
            </div>

            {apLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin"/>
              </div>
            ) : filteredLia.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-slate-600">
                <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-sm">ไม่มีรายการ</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {filteredLia
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
                    return (parseDueDate(a.due_date)?.getTime() ?? 0) - (parseDueDate(b.due_date)?.getTime() ?? 0);
                  })
                  .map((l) => {
                    const over = isOverdue(l.due_date) && l.status === "PENDING";
                    const days = l.status === "PENDING" ? daysUntil(l.due_date) : null;
                    const paid = l.status === "PAID";
                    return (
                      <div key={l.liability_id}
                        className={`grid grid-cols-[1fr_80px_110px_110px_90px_80px] px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors ${over ? "bg-red-500/[0.03]" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{l.supplier_name}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">{l.po_id} · {l.note || "—"}</p>
                        </div>
                        <p className="text-xs text-slate-400 text-center">#{l.installment_no}</p>
                        <div className="text-right">
                          <p className="text-xs text-slate-300">{fmtDueDate(l.due_date)}</p>
                          {days !== null && (
                            <p className={`text-[10px] font-semibold ${over ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-slate-600"}`}>
                              {over ? `เกิน ${Math.abs(days)} วัน` : days === 0 ? "วันนี้!" : `อีก ${days} วัน`}
                            </p>
                          )}
                          {paid && l.paid_date && <p className="text-[10px] text-emerald-500">จ่าย {fmtDueDate(l.paid_date)}</p>}
                        </div>
                        <p className={`text-sm font-bold text-right ${paid ? "text-slate-500 line-through" : over ? "text-red-400" : "text-white"}`}>
                          ฿{fmt(parseFloat(l.amount || "0"))}
                        </p>
                        <div className="flex justify-end">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            paid ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : over ? "text-red-400 bg-red-500/10 border-red-500/20"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          }`}>
                            {paid ? "PAID" : over ? "OVERDUE" : "PENDING"}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          {!paid && (
                            <button onClick={() => { setPayModal(l); setPayForm({ paid_date: "", note: "" }); setPayMsg(""); }}
                              className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 px-2.5 py-1.5 rounded-lg transition-colors">
                              บันทึกจ่าย
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pay Modal ──────────────────────────────────────────────── */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold text-white">บันทึกการชำระ</h3>
              <button onClick={() => setPayModal(null)} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="bg-white/[0.03] rounded-xl p-3 text-xs space-y-1">
                <p className="text-slate-400">{payModal.supplier_name} · งวด {payModal.installment_no}</p>
                <p className="text-white font-bold text-base">฿{fmt(parseFloat(payModal.amount || "0"))}</p>
                <p className="text-slate-500">ครบกำหนด {fmtDueDate(payModal.due_date)}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">วันที่จ่าย</label>
                <input type="date" value={payForm.paid_date}
                  onChange={(e) => setPayForm((p) => ({ ...p, paid_date: e.target.value }))}
                  className={baseInput} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">หมายเหตุ (ถ้ามี)</label>
                <input type="text" value={payForm.note} placeholder="…"
                  onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))}
                  className={baseInput} />
              </div>
              {payMsg && (
                <p className={`text-xs font-semibold ${payMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{payMsg}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/[0.08] flex gap-2 justify-end">
              <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">ยกเลิก</button>
              <button onClick={handlePay} disabled={paying}
                className="px-5 py-2 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-xl shadow-lg shadow-violet-500/20 disabled:opacity-50 transition-all flex items-center gap-2">
                {paying ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>กำลังบันทึก</> : "บันทึกการชำระ"}
              </button>
            </div>
          </div>
        </div>
      )}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
