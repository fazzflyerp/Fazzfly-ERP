"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Product { product_id: number; product_name: string; category: string; unit: string; }
interface Lot { lot_id: string; product_id: string; unit: string; qty_remaining: number; expiry_date: string; }
interface Request {
  request_id: string; product_name: string; unit: string;
  qty_requested: number; qty_approved: string; status: string; requested_at: string;
}

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all";

function statusBadge(s: string) {
  if (s === "PENDING")  return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (s === "APPROVED") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (s === "REJECTED") return "bg-red-500/15 text-red-400 border-red-500/20";
  return "bg-white/5 text-slate-400 border-white/10";
}

async function fetchRequests() {
  const res = await fetch("/api/inv/request");
  const data = await res.json();
  return data.requests?.slice(0, 10) || [];
}

export default function AddStockPage() {
  const router = useRouter();
  const [role, setRole]         = useState("");
  const [branchName, setBranchName] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots]         = useState<Lot[]>([]);
  const [myRequests, setMyRequests] = useState<Request[]>([]);
  const [form, setForm]         = useState({ product_id: "", qty_requested: "", note: "" });
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  // Edit modal state
  const [editTarget, setEditTarget] = useState<Request | null>(null);
  const [editForm, setEditForm] = useState({ qty_requested: "", note: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Request | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const [authRes, prodRes, lotsRes, reqRes] = await Promise.all([
          fetch("/api/auth/branch-check"),
          fetch("/api/inv/products"),
          fetch("/api/inv/lots?available=true"),
          fetch("/api/inv/request"),
        ]);
        const auth = await authRes.json();
        setRole(auth.role); setBranchName(auth.branchName);
        setProducts((await prodRes.json()).products || []);
        setLots((await lotsRes.json()).lots || []);
        setMyRequests((await reqRes.json()).requests?.slice(0, 10) || []);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
    init();
  }, []);

  const sel = products.find((p) => p.product_id.toString() === form.product_id);
  const availableLots = lots.filter((l) => l.product_id.toString() === form.product_id && l.qty_remaining > 0);
  const totalAvailable = availableLots.reduce((s, l) => s + l.qty_remaining, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/inv/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: sel.product_id, product_name: sel.product_name, unit: sel.unit, qty_requested: Number(form.qty_requested), note: form.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`✓ ส่งคำขอสำเร็จ · ${data.request_id}`);
      setForm({ product_id: "", qty_requested: "", note: "" });
      setMyRequests(await fetchRequests());
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  function openEdit(r: Request) {
    setEditTarget(r);
    setEditForm({ qty_requested: String(r.qty_requested), note: "" });
    setEditError("");
  }

  function closeEdit() {
    setEditTarget(null);
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true); setEditError("");
    try {
      const res = await fetch("/api/inv/request", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: editTarget.request_id,
          qty_requested: Number(editForm.qty_requested),
          note: editForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMyRequests(await fetchRequests());
      closeEdit();
    } catch (e: any) { setEditError(e.message); }
    finally { setEditLoading(false); }
  }

  function openDelete(r: Request) {
    setDeleteTarget(r);
    setDeleteError("");
  }

  function closeDelete() {
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true); setDeleteError("");
    try {
      const res = await fetch("/api/inv/request", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: deleteTarget.request_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMyRequests(await fetchRequests());
      closeDelete();
    } catch (e: any) { setDeleteError(e.message); }
    finally { setDeleteLoading(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[350px] h-[350px] rounded-full bg-cyan-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(59,130,246,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-base">เบิกสินค้าจากคลังกลาง</h1>
          <p className="text-slate-500 text-xs">{branchName || "สาขา"} — Add Stock Request</p>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Form */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
          <h2 className="text-white font-semibold mb-5">เบิกสินค้า</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">สินค้า *</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required className={selectCls}>
                <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                {products.map((p) => <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">{p.product_name}</option>)}
              </select>
              {form.product_id && (
                <div className="mt-2">
                  {availableLots.length > 0 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 space-y-1">
                      <p className="text-xs text-emerald-400 font-medium">มีในคลังกลาง: {totalAvailable} {sel?.unit}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {availableLots.slice(0, 3).map((l) => (
                          <span key={l.lot_id} className="text-xs text-emerald-500/70">{l.lot_id}: {l.qty_remaining} (หมด {l.expiry_date})</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                      <p className="text-xs text-amber-400">⚠ ของหมดในคลังกลาง — ส่งคำขอได้เลย Super Admin จะเห็นว่าสาขาต้องการอะไร</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">จำนวนที่ขอ ({sel?.unit || "หน่วย"}) *</label>
              <input type="number" min="1" value={form.qty_requested}
                onChange={(e) => setForm({ ...form, qty_requested: e.target.value })}
                required placeholder="0" className={inputCls} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
              <input type="text" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
            </div>

            {error   && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>}
            {success && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">{success}</p>}

            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ boxShadow: "0 4px 20px rgba(59,130,246,0.3)" }}>
              {submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอ →"}
            </button>
          </form>
        </div>

        {/* Requests history */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-semibold">คำขอล่าสุด</h2>
          </div>
          {myRequests.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-600 text-center">ยังไม่มีคำขอ</p>
          ) : (
            <div className="divide-y divide-white/5">
              {myRequests.map((r) => (
                <div key={r.request_id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium">{r.product_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span className="text-slate-600 font-mono">{r.request_id}</span>
                      <span className="mx-1.5">·</span>ขอ {r.qty_requested} {r.unit}
                      {r.qty_approved ? <span className="text-emerald-500"> · อนุมัติ {r.qty_approved}</span> : ""}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{r.requested_at}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => openEdit(r)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => openDelete(r)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          ลบ
                        </button>
                      </>
                    )}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge(r.status)}`}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEdit} />
          <div className="relative w-full max-w-md bg-[#0a0f1e] border border-white/10 rounded-[24px] overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div>
                <h3 className="text-white font-semibold">แก้ไขคำขอ</h3>
                <p className="text-xs text-slate-500 mt-0.5">{editTarget.product_name} · <span className="font-mono">{editTarget.request_id}</span></p>
              </div>
              <button onClick={closeEdit} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                  จำนวนที่ขอ ({editTarget.unit}) *
                </label>
                <input
                  type="number" min="1" required
                  value={editForm.qty_requested}
                  onChange={(e) => setEditForm({ ...editForm, qty_requested: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
                <input
                  type="text"
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="หมายเหตุ (ถ้ามี)"
                  className={inputCls}
                />
              </div>

              {editError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{editError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={closeEdit}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit" disabled={editLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                  style={{ boxShadow: "0 4px 20px rgba(59,130,246,0.3)" }}
                >
                  {editLoading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDelete} />
          <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

            <div className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-white font-semibold">ลบคำขอ?</h3>
                <p className="text-sm text-slate-400 mt-1">{deleteTarget.product_name}</p>
                <p className="text-xs text-slate-600 mt-0.5 font-mono">{deleteTarget.request_id}</p>
                <p className="text-xs text-slate-500 mt-2">คำขอนี้จะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
              </div>

              {deleteError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-center">{deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button" onClick={closeDelete}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button" onClick={handleDelete} disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                >
                  {deleteLoading ? "กำลังลบ..." : "ลบ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
