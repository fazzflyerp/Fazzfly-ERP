"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Liability {
  liability_id: string;
  po_id: string;
  supplier_name: string;
  installment_no: string;
  due_date: string;
  amount: string;
  paid_date: string;
  status: string;
  note: string;
  created_at: string;
}

type Filter = "PENDING" | "PAID" | "ALL";

const inputCls = "bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all";

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  const parts = dueDate.split("/");
  if (parts.length !== 3) return false;
  const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return d < new Date();
}

export default function LiabilitiesPage() {
  const router = useRouter();

  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<Filter>("PENDING");
  const [error, setError]             = useState("");

  // Pay modal
  const [payModal, setPayModal]       = useState<Liability | null>(null);
  const [payForm, setPayForm]         = useState({ paid_date: "", note: "" });
  const [paying, setPaying]           = useState(false);
  const [payMsg, setPayMsg]           = useState("");

  useEffect(() => {
    async function init() {
      try {
        const [authRes, liaRes] = await Promise.all([
          fetch("/api/auth/branch-check"),
          fetch("/api/inv/liabilities"),
        ]);
        const auth = await authRes.json();
        if (auth.role !== "SUPER_ADMIN") { router.replace("/ERP/home-demo"); return; }
        setLiabilities((await liaRes.json()).liabilities || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return liabilities;
    return liabilities.filter((l) => l.status === filter);
  }, [liabilities, filter]);

  const totals = useMemo(() => {
    const pending = liabilities.filter((l) => l.status === "PENDING").reduce((s, l) => s + Number(l.amount || 0), 0);
    const paid    = liabilities.filter((l) => l.status === "PAID").reduce((s, l) => s + Number(l.amount || 0), 0);
    const overdue = liabilities.filter((l) => l.status === "PENDING" && isOverdue(l.due_date)).reduce((s, l) => s + Number(l.amount || 0), 0);
    return { pending, paid, overdue };
  }, [liabilities]);

  const counts = {
    PENDING: liabilities.filter((l) => l.status === "PENDING").length,
    PAID:    liabilities.filter((l) => l.status === "PAID").length,
    ALL:     liabilities.length,
  };

  async function handlePay() {
    if (!payModal) return;
    setPaying(true); setPayMsg("");
    try {
      const res = await fetch("/api/inv/liabilities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liability_id: payModal.liability_id,
          paid_date:    payForm.paid_date || undefined,
          note:         payForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPayMsg("บันทึกการชำระสำเร็จ");

      // Update in-place
      setLiabilities((prev) => prev.map((l) =>
        l.liability_id === payModal.liability_id
          ? { ...l, status: "PAID", paid_date: payForm.paid_date || "วันนี้", note: payForm.note || l.note }
          : l
      ));
      setTimeout(() => { setPayModal(null); setPayForm({ paid_date: "", note: "" }); }, 800);
    } catch (e: any) {
      setPayMsg(`❌ ${e.message}`);
    } finally {
      setPaying(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-10 h-10 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-base">การจัดการหนี้สิน</h1>
          <p className="text-slate-500 text-xs">Liabilities — ตารางการชำระค่าสินค้า</p>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-6 space-y-5">

        {error && (
          <div className="px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 mb-1">ยังไม่ชำระ</p>
            <p className="text-xl font-bold text-amber-400">{totals.pending.toLocaleString()}</p>
            <p className="text-xs text-slate-600 mt-0.5">บาท · {counts.PENDING} งวด</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 mb-1">เกินกำหนด</p>
            <p className={`text-xl font-bold ${totals.overdue > 0 ? "text-red-400" : "text-slate-600"}`}>
              {totals.overdue.toLocaleString()}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">บาท</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 mb-1">ชำระแล้ว</p>
            <p className="text-xl font-bold text-emerald-400">{totals.paid.toLocaleString()}</p>
            <p className="text-xs text-slate-600 mt-0.5">บาท · {counts.PAID} งวด</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["PENDING", "PAID", "ALL"] as Filter[]).map((f) => {
            const labels = { PENDING: "รอชำระ", PAID: "ชำระแล้ว", ALL: "ทั้งหมด" };
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
                  filter === f
                    ? f === "PENDING"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : f === "PAID"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-white/10 border-white/20 text-white"
                    : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"
                }`}>
                <span>{labels[f]}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-lg bg-white/10">{counts[f]}</span>
              </button>
            );
          })}
        </div>

        {/* Liabilities table */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-600">ไม่มีรายการ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="px-5 py-3">PO / Supplier</th>
                    <th className="px-5 py-3">งวดที่</th>
                    <th className="px-5 py-3">ครบกำหนด</th>
                    <th className="px-5 py-3 text-right">จำนวน (บาท)</th>
                    <th className="px-5 py-3">สถานะ</th>
                    <th className="px-5 py-3">วันที่ชำระ</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => {
                    const overdue = l.status === "PENDING" && isOverdue(l.due_date);
                    return (
                      <tr key={l.liability_id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-mono text-xs text-violet-400">{l.po_id}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{l.supplier_name || "—"}</p>
                        </td>
                        <td className="px-5 py-3 text-slate-300">งวด {l.installment_no}</td>
                        <td className="px-5 py-3">
                          <span className={overdue ? "text-red-400 font-medium" : "text-slate-400"}>
                            {l.due_date || "—"}
                          </span>
                          {overdue && (
                            <span className="ml-2 text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded-lg">เกินกำหนด</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-white">
                          {Number(l.amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          {l.status === "PAID" ? (
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">ชำระแล้ว</span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                              overdue
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            }`}>รอชำระ</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{l.paid_date || "—"}</td>
                        <td className="px-5 py-3">
                          {l.status === "PENDING" && (
                            <button
                              onClick={() => { setPayModal(l); setPayMsg(""); setPayForm({ paid_date: "", note: "" }); }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-all whitespace-nowrap">
                              บันทึกชำระ
                            </button>
                          )}
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

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !paying) setPayModal(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">บันทึกการชำระเงิน</h3>
              <button onClick={() => setPayModal(null)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">PO</span><span className="font-mono text-violet-400">{payModal.po_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">งวดที่</span><span className="text-white">งวด {payModal.installment_no}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ครบกำหนด</span><span className={isOverdue(payModal.due_date) ? "text-red-400" : "text-slate-300"}>{payModal.due_date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">จำนวน</span><span className="text-white font-bold">{Number(payModal.amount).toLocaleString()} บาท</span></div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">วันที่ชำระ (ปล่อยว่าง = วันนี้)</label>
                <input type="date" value={payForm.paid_date}
                  onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })}
                  className={`${inputCls} w-full`} style={{ colorScheme: "dark" }} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">หมายเหตุ</label>
                <input type="text" value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  placeholder="เช่น โอนผ่านธนาคาร" className={`${inputCls} w-full`} />
              </div>
            </div>

            {payMsg && (
              <p className={`mb-3 text-sm px-4 py-2.5 rounded-xl border ${
                payMsg.startsWith("❌")
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>{payMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} disabled={paying}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handlePay} disabled={paying}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {paying ? "กำลังบันทึก..." : "ยืนยันชำระ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
