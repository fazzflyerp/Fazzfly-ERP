"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface AvailableProduct {
  product_id: string; product_name: string; category: string; unit: string; total_remaining: number;
}
interface UsageRecord {
  usage_id: string; product_name: string; unit: string; qty_used: number;
  lot_id: string; expiry_date: string; doctor: string; note: string; used_by: string; used_at: string;
  cost_per_unit: number; cost_total: number;
}
interface BranchSheet { branchId: string; branchName: string; }
interface Doctor { name: string; license: string; }

interface DeleteTarget {
  usage_id: string; product_name: string; qty_used: number; unit: string; lot_id: string;
}

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 transition-all";

export default function InvUsagePage() {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [role, setRole]               = useState("");
  const [branchName, setBranchName]   = useState<string | null>(null);
  const [allBranches, setAllBranches] = useState<BranchSheet[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [products, setProducts]       = useState<AvailableProduct[]>([]);
  const [doctors, setDoctors]         = useState<Doctor[]>([]);
  const [usages, setUsages]           = useState<UsageRecord[]>([]);
  const [form, setForm]               = useState({ product_id: "", qty_used: "", doctor: "", note: "" });
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState("");

  async function loadData(bId?: string) {
    const bp = bId ? `&branchId=${encodeURIComponent(bId)}` : "";
    const qp = bId ? `?branchId=${encodeURIComponent(bId)}` : "";
    const [pd, ud, dd] = await Promise.all([
      fetch(`/api/inv/usage?available=true${bp}`).then((r) => r.json()),
      fetch(`/api/inv/usage${qp}`).then((r) => r.json()),
      fetch(`/api/inv/doctors${qp}`).then((r) => r.json()),
    ]);
    setProducts(pd.products || []);
    setUsages(ud.usages || []);
    setDoctors(dd.doctors || []);
  }

  async function refreshProducts(bId?: string) {
    const bp = bId ? `&branchId=${encodeURIComponent(bId)}` : "";
    const pd = await fetch(`/api/inv/usage?available=true&fresh=1${bp}`).then((r) => r.json());
    setProducts(pd.products || []);
  }

  async function refreshDoctors(bId?: string) {
    const qp = bId ? `?branchId=${encodeURIComponent(bId)}&fresh=1` : "?fresh=1";
    const dd = await fetch(`/api/inv/doctors${qp}`).then((r) => r.json());
    setDoctors(dd.doctors || []);
  }

  useEffect(() => {
    async function init() {
      try {
        const auth = await fetch("/api/auth/branch-check").then((r) => r.json());
        setRole(auth.role); setBranchName(auth.branchName);

        if (auth.role === "SUPER_ADMIN") {
          const reqData = await fetch("/api/inv/request").then((r) => r.json());
          const seen = new Map<string, string>();
          (reqData.requests || []).forEach((r: any) => { if (r.branch_id) seen.set(r.branch_id, r.branch_name); });
          const branches: BranchSheet[] = Array.from(seen.entries()).map(([id, name]) => ({ branchId: id, branchName: name }));
          setAllBranches(branches);
          if (branches.length > 0) { setSelectedBranch(branches[0].branchId); await loadData(branches[0].branchId); }
        } else {
          await loadData();
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
    init();
  }, []);

  async function handleBranchChange(bid: string) {
    setSelectedBranch(bid);
    setForm({ product_id: "", qty_used: "", doctor: "", note: "" });
    setLoading(true);
    try { await loadData(bid); } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const sel = products.find((p) => p.product_id.toString() === form.product_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const body: any = {
        product_id: sel.product_id, product_name: sel.product_name,
        category: sel.category, unit: sel.unit,
        qty_used: Number(form.qty_used), doctor: form.doctor, note: form.note,
      };
      if (role === "SUPER_ADMIN" && selectedBranch) body.branch_id = selectedBranch;
      const res  = await fetch("/api/inv/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`✓ บันทึกสำเร็จ · ${data.usage_id}`);
      setForm({ product_id: "", qty_used: "", doctor: "", note: "" });
      await loadData(role === "SUPER_ADMIN" ? selectedBranch : undefined);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function openDeleteModal(u: UsageRecord) {
    setDeleteTarget({ usage_id: u.usage_id, product_name: u.product_name, qty_used: u.qty_used, unit: u.unit, lot_id: u.lot_id });
    setDeleteError("");
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError("");
    try {
      const body: any = { usage_id: deleteTarget.usage_id };
      if (role === "SUPER_ADMIN" && selectedBranch) body.branch_id = selectedBranch;
      const res  = await fetch("/api/inv/usage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      // Remove from local list immediately
      setUsages((prev) => prev.filter((u) => u.usage_id !== deleteTarget.usage_id));
      // Refresh products dropdown so qty reflects restored stock
      const bp = selectedBranch ? `&branchId=${encodeURIComponent(selectedBranch)}` : "";
      const pd = await fetch(`/api/inv/usage?available=true${bp}`).then((r) => r.json());
      setProducts(pd.products || []);
      setDeleteTarget(null);
    } catch (e: any) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-10 h-10 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
    </div>
  );

  const currentBranchName = role === "SUPER_ADMIN"
    ? allBranches.find((b) => b.branchId === selectedBranch)?.branchName || "เลือกสาขา"
    : branchName || "สาขา";

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[350px] h-[350px] rounded-full bg-violet-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(168,85,247,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-base">บันทึกการใช้สินค้า</h1>
          <p className="text-slate-500 text-xs">{currentBranchName} — FIFO Auto</p>
        </div>
      </header>

      {/* Branch switcher (Super Admin) */}
      {role === "SUPER_ADMIN" && allBranches.length > 0 && (
        <div className="relative z-10 border-b border-white/5 bg-white/[0.01] px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 uppercase tracking-wider">สาขา</span>
            <div className="flex gap-2">
              {allBranches.map((b) => (
                <button key={b.branchId} onClick={() => handleBranchChange(b.branchId)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    selectedBranch === b.branchId
                      ? "bg-gradient-to-r from-purple-500 to-violet-400 text-white shadow-lg"
                      : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                  }`}>
                  {b.branchName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-6 space-y-5">

        {/* Form */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-white font-semibold">บันทึกการใช้</h2>
            <span className="px-2.5 py-1 bg-purple-500/15 border border-purple-500/20 text-purple-400 text-xs rounded-lg font-medium">FIFO อัตโนมัติ</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">สินค้า *</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                onFocus={() => refreshProducts(selectedBranch || undefined)}
                required className={selectCls}>
                <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">
                    {p.product_name} — คงเหลือ {p.total_remaining} {p.unit}
                  </option>
                ))}
              </select>
              {products.length === 0 && (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-amber-400">ไม่มีสินค้าในสต๊อคสาขา — ลองเบิกสินค้าจากคลังกลางก่อน</p>
                </div>
              )}
              {sel && (
                <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2">
                  <p className="text-xs text-purple-400">คงเหลือในสต๊อค: <span className="font-semibold">{sel.total_remaining} {sel.unit}</span></p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">จำนวนที่ใช้ ({sel?.unit || "หน่วย"}) *</label>
                <input type="number" min="1" max={sel?.total_remaining} value={form.qty_used}
                  onChange={(e) => setForm({ ...form, qty_used: e.target.value })}
                  required placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">แพทย์ผู้ใช้</label>
                {doctors.length > 0 ? (
                  <select value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                    onFocus={() => refreshDoctors(selectedBranch || undefined)}
                    className={selectCls}>
                    <option value="" className="bg-[#0d1526]">— เลือกแพทย์ —</option>
                    {doctors.map((d) => (
                      <option key={d.name} value={d.name} className="bg-[#0d1526]">
                        {d.name}{d.license ? ` (${d.license})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={form.doctor}
                    onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                    placeholder="ชื่อแพทย์ (ถ้ามี)" className={inputCls} />
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
              <input type="text" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
            </div>

            {error   && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>}
            {success && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">{success}</p>}

            <button type="submit" disabled={submitting || products.length === 0}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-violet-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ boxShadow: "0 4px 20px rgba(168,85,247,0.3)" }}>
              {submitting ? "กำลังบันทึก..." : "บันทึกการใช้"}
            </button>
          </form>
        </div>

        {/* Usage history */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-white font-semibold">ประวัติการใช้</h2>
            <div className="flex items-center gap-4">
              {usages.some((u) => u.cost_total > 0) && (
                <span className="text-sm text-amber-400 font-semibold">
                  ต้นทุนรวม ฿{usages.reduce((s, u) => s + (u.cost_total || 0), 0).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
              <span className="text-xs text-slate-500">{usages.length} รายการ</span>
            </div>
          </div>

          {usages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-600 text-sm">ยังไม่มีประวัติการใช้</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="px-5 py-3.5">Usage ID</th>
                    <th className="px-5 py-3.5">สินค้า</th>
                    <th className="px-5 py-3.5 text-right">จำนวน</th>
                    <th className="px-5 py-3.5 text-right">ราคา/หน่วย</th>
                    <th className="px-5 py-3.5 text-right">ต้นทุนรวม</th>
                    <th className="px-5 py-3.5">Lot</th>
                    <th className="px-5 py-3.5">แพทย์</th>
                    <th className="px-5 py-3.5">บันทึกโดย</th>
                    <th className="px-5 py-3.5">วันที่</th>
                    {role === "SUPER_ADMIN" && <th className="px-5 py-3.5" />}
                  </tr>
                </thead>
                <tbody>
                  {usages.map((u) => (
                    <tr key={u.usage_id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-purple-400">{u.usage_id}</td>
                      <td className="px-5 py-3.5 text-white font-medium">{u.product_name}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-white">{u.qty_used} <span className="text-xs text-slate-500 font-normal">{u.unit}</span></td>
                      <td className="px-5 py-3.5 text-right text-slate-400 text-xs">
                        {u.cost_per_unit > 0 ? `฿${u.cost_per_unit.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {u.cost_total > 0
                          ? <span className="font-semibold text-amber-400">฿{u.cost_total.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{u.lot_id}</td>
                      <td className="px-5 py-3.5 text-slate-400">{u.doctor || "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{u.used_by}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{u.used_at}</td>
                      {role === "SUPER_ADMIN" && (
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openDeleteModal(u)}
                            className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 text-xs font-medium transition-all"
                          >
                            ลบ
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDeleteModal} />

          {/* Modal */}
          <div className="relative w-full max-w-sm bg-[#0d1526] border border-white/10 rounded-[24px] p-6 shadow-2xl" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            {/* Top accent */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />

            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <h3 className="text-white font-bold text-center text-base mb-1">ยืนยันการลบรายการ</h3>
            <p className="text-slate-500 text-xs text-center mb-5">รายการนี้จะถูกลบออกจากระบบ</p>

            {/* Usage detail card */}
            <div className="bg-white/[0.04] border border-white/8 rounded-2xl px-5 py-4 space-y-2.5 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Usage ID</span>
                <span className="font-mono text-xs text-purple-400">{deleteTarget.usage_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">สินค้า</span>
                <span className="text-sm text-white font-medium">{deleteTarget.product_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">จำนวน</span>
                <span className="text-sm font-bold text-white">{deleteTarget.qty_used} <span className="text-xs text-slate-400 font-normal">{deleteTarget.unit}</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Lot</span>
                <span className="font-mono text-xs text-slate-400">{deleteTarget.lot_id}</span>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
              <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-amber-400 leading-relaxed">การลบจะคืน qty กลับ INV_Stock ของ lot นี้</p>
            </div>

            {deleteError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl mb-4">{deleteError}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}
              >
                {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
