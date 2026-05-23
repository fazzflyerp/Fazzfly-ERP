"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Product {
  product_id: number;
  product_name: string;
  category: string;
  brand: string;
  unit: string;
  unit_pkg: string;
  qty_per_pkg: number;
}

interface Purchase {
  purchase_id: string;
  product_name: string;
  unit: string;
  unit_pkg: string;
  qty_per_pkg: string;
  qty_ordered: string;
  qty_unit: string;
  cost_per_pkg: string;
  cost_total: string;
  supplier: string;
  purchase_date: string;
  expiry_date: string;
  lot_id: string;
  status: string;
  note: string;
  created_at: string;
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all";
const selectCls = "w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all appearance-none";

export default function InvPurchasePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts]   = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  // Delete PO modal
  const [deletePO, setDeletePO]   = useState<Purchase | null>(null);
  const [deletePoMsg, setDeletePoMsg] = useState("");
  const [deletingPO, setDeletingPO]   = useState(false);

  // Edit PO modal
  const [editPO, setEditPO]       = useState<Purchase | null>(null);
  const [editForm, setEditForm]   = useState({ qty_ordered: "", cost_total: "", supplier: "", purchase_date: "", expiry_date: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg]     = useState("");

  const [form, setForm] = useState({
    product_id: "", qty_ordered: "", cost_total: "",
    supplier: "", purchase_date: new Date().toISOString().slice(0, 10),
    expiry_date: "", note: "",
  });

  useEffect(() => {
    async function init() {
      try {
        const [authRes, prodRes, supRes, poRes] = await Promise.all([
          fetch("/api/auth/branch-check"),
          fetch("/api/inv/products"),
          fetch("/api/inv/suppliers"),
          fetch("/api/inv/purchase"),
        ]);
        const auth = await authRes.json();
        if (auth.role !== "SUPER_ADMIN") { router.replace("/ERP/home-demo"); return; }
        const prods: Product[] = (await prodRes.json()).products || [];
        setProducts(prods);
        setSuppliers((await supRes.json()).suppliers || []);
        setPurchases((await poRes.json()).purchases || []);

        // Pre-select product from query param (จากปุ่มสั่งซื้อใน Pending Requests)
        const qProductId = searchParams.get("productId");
        if (qProductId) {
          const match = prods.find((p) => p.product_id.toString() === qProductId);
          if (match) setForm((f) => ({ ...f, product_id: match.product_id.toString() }));
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    }
    init();
  }, [router, searchParams]);

  const sel     = products.find((p) => p.product_id.toString() === form.product_id);
  const qtyUnit = form.qty_ordered && sel ? Number(form.qty_ordered) * sel.qty_per_pkg : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/inv/purchase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: sel.product_id, product_name: sel.product_name,
          category: sel.category, brand: sel.brand, unit: sel.unit,
          unit_pkg: sel.unit_pkg, qty_per_pkg: sel.qty_per_pkg,
          qty_ordered: Number(form.qty_ordered), cost_total: Number(form.cost_total),
          supplier: form.supplier, purchase_date: form.purchase_date,
          expiry_date: form.expiry_date, note: form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`✓ สร้าง PO สำเร็จ: ${data.purchase_id}  ·  LOT: ${data.lot_id}`);
      setForm({ product_id: "", qty_ordered: "", cost_total: "", supplier: "",
        purchase_date: new Date().toISOString().slice(0, 10), expiry_date: "", note: "" });
      setPurchases((await (await fetch("/api/inv/purchase")).json()).purchases || []);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  async function handleDeletePO() {
    if (!deletePO) return;
    setDeletingPO(true); setDeletePoMsg("");
    try {
      const res  = await fetch("/api/inv/purchase", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_id: deletePO.purchase_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDeletePoMsg("✓ ลบ PO สำเร็จ");
      setPurchases((prev) => prev.filter((p) => p.purchase_id !== deletePO.purchase_id));
      setTimeout(() => setDeletePO(null), 800);
    } catch (e: any) { setDeletePoMsg(`❌ ${e.message}`); }
    finally { setDeletingPO(false); }
  }

  function openEditPO(po: Purchase) {
    setEditPO(po);
    setEditMsg("");
    setEditForm({
      qty_ordered:   po.qty_ordered,
      cost_total:    po.cost_total,
      supplier:      po.supplier,
      purchase_date: po.purchase_date,
      expiry_date:   po.expiry_date,
      note:          po.note || "",
    });
  }

  async function handleEditSave() {
    if (!editPO) return;
    setEditSaving(true); setEditMsg("");
    try {
      const res  = await fetch("/api/inv/purchase", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_id:   editPO.purchase_id,
          qty_ordered:   Number(editForm.qty_ordered),
          cost_total:    Number(editForm.cost_total),
          supplier:      editForm.supplier,
          purchase_date: editForm.purchase_date,
          expiry_date:   editForm.expiry_date,
          note:          editForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEditMsg("✓ บันทึกสำเร็จ");
      setPurchases((await (await fetch("/api/inv/purchase")).json()).purchases || []);
      setTimeout(() => setEditPO(null), 900);
    } catch (e: any) { setEditMsg(`❌ ${e.message}`); }
    finally { setEditSaving(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-base">สั่งซื้อสินค้า</h1>
          <p className="text-slate-500 text-xs">INV Purchase — Central Warehouse</p>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Banner: came from pending request */}
        {searchParams.get("productName") && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-500/10 border border-blue-500/20 rounded-[18px]">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-blue-400 text-sm">
              สั่งซื้อจากคำขอสาขา — สินค้า <span className="font-semibold">{searchParams.get("productName")}</span> ถูกเลือกอัตโนมัติ
            </p>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 relative overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          <h2 className="text-white font-semibold mb-5">สร้าง Purchase Order ใหม่</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="md:col-span-2">
                <InputField label="สินค้า *">
                  <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required className={selectCls}>
                    <option value="" className="bg-[#0a0f1e]">— เลือกสินค้า —</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id} className="bg-[#0a0f1e]">
                        {p.product_name}{p.brand ? ` (${p.brand})` : ""}
                      </option>
                    ))}
                  </select>
                  {sel && (
                    <p className="text-xs text-emerald-400 mt-1.5">หน่วย: {sel.unit} · บรรจุ {sel.qty_per_pkg} {sel.unit}/{sel.unit_pkg}</p>
                  )}
                </InputField>
              </div>

              <InputField label={`จำนวน (${sel?.unit_pkg || "หน่วยบรรจุ"}) *`}>
                <input type="number" min="1" value={form.qty_ordered}
                  onChange={(e) => setForm({ ...form, qty_ordered: e.target.value })}
                  required placeholder="0" className={inputCls} />
                {qtyUnit > 0 && <p className="text-xs text-emerald-400 mt-1.5">= {qtyUnit} {sel?.unit}</p>}
              </InputField>

              <InputField label="ราคารวม (บาท)">
                <input type="number" min="0" value={form.cost_total}
                  onChange={(e) => setForm({ ...form, cost_total: e.target.value })}
                  placeholder="0" className={inputCls} />
              </InputField>

              <InputField label="ผู้จัดจำหน่าย">
                <select value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className={selectCls}>
                  <option value="" className="bg-[#0a0f1e]">— เลือก Supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s} className="bg-[#0a0f1e]">{s}</option>
                  ))}
                </select>
              </InputField>

              <InputField label="วันที่สั่งซื้อ *">
                <input type="date" value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  required className={inputCls} style={{ colorScheme: "dark" }} />
              </InputField>

              <InputField label="วันหมดอายุ *">
                <input type="date" value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  required className={inputCls} style={{ colorScheme: "dark" }} />
              </InputField>

              <div className="md:col-span-2">
                <InputField label="หมายเหตุ">
                  <input type="text" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
                </InputField>
              </div>
            </div>

            {error   && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>}
            {success && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl">{success}</p>}

            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all shadow-lg"
              style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
              {submitting ? "กำลังบันทึก..." : "สร้าง PO + Lot"}
            </button>
          </form>
        </div>

        {/* Purchase list */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-semibold">รายการ PO ทั้งหมด</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">PO ID</th>
                  <th className="px-5 py-3">สินค้า</th>
                  <th className="px-5 py-3 text-right">จำนวน (unit)</th>
                  <th className="px-5 py-3 text-right">ราคารวม</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">วันซื้อ</th>
                  <th className="px-5 py-3">หมดอายุ</th>
                  <th className="px-5 py-3">Lot</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-slate-600">ยังไม่มีรายการ</td></tr>
                ) : purchases.map((po) => (
                  <tr key={po.purchase_id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-emerald-400">{po.purchase_id}</td>
                    <td className="px-5 py-3 text-white font-medium">{po.product_name}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{po.qty_unit}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{Number(po.cost_total || 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-500">{po.supplier || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{po.purchase_date}</td>
                    <td className="px-5 py-3 text-slate-500">{po.expiry_date}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{po.lot_id}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditPO(po)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/15 hover:border-emerald-500/20 hover:text-emerald-400 text-xs font-medium transition-all">
                          แก้ไข
                        </button>
                        <button onClick={() => { setDeletePO(po); setDeletePoMsg(""); }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-600 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete PO Modal */}
      {deletePO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deletingPO) setDeletePO(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">ยืนยันลบ PO</h3>
                <p className="text-slate-500 text-xs">ลบถาวร — ไม่สามารถกู้คืนได้</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">PO ID</span><span className="text-red-400 font-mono">{deletePO.purchase_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สินค้า</span><span className="text-white font-semibold">{deletePO.product_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">จำนวน</span><span className="text-slate-300">{deletePO.qty_unit} {deletePO.unit}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Lot</span><span className="text-slate-400 font-mono text-xs">{deletePO.lot_id || "—"}</span></div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-amber-400 text-xs">Lot ที่เชื่อมกับ PO นี้จะถูกลบด้วย หากยังไม่มีการโอนสต๊อคออกไปสาขา</p>
            </div>

            {deletePoMsg && (
              <p className={`mb-4 text-sm px-4 py-2.5 rounded-xl border ${
                deletePoMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{deletePoMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDeletePO(null)} disabled={deletingPO}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleDeletePO} disabled={deletingPO}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {deletingPO ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO Modal */}
      {editPO && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !editSaving) setEditPO(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-lg p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold">แก้ไข PO</h3>
                <p className="text-emerald-400 font-mono text-xs mt-0.5">{editPO.purchase_id} · {editPO.product_name}</p>
              </div>
              <button onClick={() => setEditPO(null)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">จำนวน ({editPO.unit_pkg})</label>
                  <input type="number" min="1" value={editForm.qty_ordered}
                    onChange={(e) => setEditForm({ ...editForm, qty_ordered: e.target.value })}
                    className={inputCls} />
                  {editForm.qty_ordered && editPO.qty_per_pkg && (
                    <p className="text-xs text-emerald-400/70 mt-1">= {Number(editForm.qty_ordered) * Number(editPO.qty_per_pkg)} {editPO.unit}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">ราคารวม (บาท)</label>
                  <input type="number" min="0" value={editForm.cost_total}
                    onChange={(e) => setEditForm({ ...editForm, cost_total: e.target.value })}
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Supplier</label>
                <select value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} className={selectCls}>
                  <option value="" className="bg-[#0a0f1e]">— เลือก Supplier —</option>
                  {suppliers.map((s) => <option key={s} value={s} className="bg-[#0a0f1e]">{s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">วันที่สั่งซื้อ</label>
                  <input type="date" value={editForm.purchase_date}
                    onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })}
                    className={inputCls} style={{ colorScheme: "dark" }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">วันหมดอายุ</label>
                  <input type="date" value={editForm.expiry_date}
                    onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                    className={inputCls} style={{ colorScheme: "dark" }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">หมายเหตุ</label>
                <input type="text" value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
              </div>
            </div>

            {editMsg && (
              <p className={`mt-3 text-sm px-4 py-2.5 rounded-xl border ${
                editMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{editMsg}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditPO(null)} disabled={editSaving}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {editSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
