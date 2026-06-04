"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface StockItem {
  lot_id: string; product_name: string; category: string; brand: string;
  unit: string; qty_remaining: number; qty_original: number;
  expiry_date: string; purchase_date: string; supplier: string;
}

interface DeleteModal {
  open: boolean;
  item: StockItem | null;
}

export default function InvStockPage() {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [stock, setStock]         = useState<StockItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [deleteModal, setDeleteModal] = useState<DeleteModal>({ open: false, item: null });
  const [deleting, setDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMsg, setSuccessMsg]   = useState("");

  const fetchStock = useCallback(() => {
    setLoading(true);
    fetch("/api/inv/stock?type=central")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setStock(d.stock || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const today = new Date();
  const warn30 = new Date(today); warn30.setDate(today.getDate() + 30);

  const withStock  = stock.filter((s) => s.qty_remaining > 0).length;
  const nearExpiry = stock.filter((s) => {
    const e = s.expiry_date ? new Date(s.expiry_date) : null;
    return e && e <= warn30 && s.qty_remaining > 0;
  }).length;

  function openDelete(item: StockItem) {
    setDeleteError("");
    setDeleteModal({ open: true, item });
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteModal({ open: false, item: null });
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleteModal.item) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/inv/lots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: deleteModal.item.lot_id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "ลบไม่สำเร็จ");
      setDeleteModal({ open: false, item: null });
      setSuccessMsg(`ลบ Lot ${deleteModal.item.lot_id} เรียบร้อยแล้ว`);
      setTimeout(() => setSuccessMsg(""), 3500);
      fetchStock();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setDeleting(false);
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
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">สต๊อคคลังกลาง</h1>
          <p className="text-slate-500 text-xs">Central Inventory — ทุก Lot</p>
        </div>
        {nearExpiry > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/15 border border-red-500/20 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">ใกล้หมดอายุ {nearExpiry} รายการ</span>
          </div>
        )}
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-6">
        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {/* Success toast */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
            </svg>
            <span className="text-sm text-emerald-400">{successMsg}</span>
          </div>
        )}

        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
            <div className="px-6 py-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Lot ทั้งหมด</p>
              <p className="text-2xl font-bold text-white mt-1">{stock.length}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">มีของอยู่</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{withStock}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">ใกล้หมดอายุ</p>
              <p className={`text-2xl font-bold mt-1 ${nearExpiry > 0 ? "text-red-400" : "text-slate-600"}`}>{nearExpiry}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-5 py-3.5">Lot ID</th>
                  <th className="px-5 py-3.5">สินค้า</th>
                  <th className="px-5 py-3.5">หมวด</th>
                  <th className="px-5 py-3.5 text-right">คงเหลือ</th>
                  <th className="px-5 py-3.5 text-right">ต้นฉบับ</th>
                  <th className="px-5 py-3.5">หมดอายุ</th>
                  <th className="px-5 py-3.5">วันซื้อ</th>
                  <th className="px-5 py-3.5">Supplier</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-14 text-center text-slate-600">ยังไม่มีสต๊อคในคลังกลาง</td></tr>
                ) : stock.map((s, idx) => {
                  const expDate = s.expiry_date ? new Date(s.expiry_date) : null;
                  const isWarn  = expDate ? expDate <= warn30 : false;
                  const isEmpty = s.qty_remaining === 0;
                  return (
                    <tr key={s.lot_id + idx} className={`group border-t border-white/5 hover:bg-white/[0.03] transition-colors ${isEmpty ? "opacity-30" : ""}`}>
                      <td className="px-5 py-3.5 font-mono text-xs text-violet-400">{s.lot_id}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-white font-medium">{s.product_name}</p>
                        {s.brand && <p className="text-xs text-slate-500">{s.brand}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{s.category}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold text-base ${isEmpty ? "text-slate-600" : isWarn ? "text-amber-400" : "text-white"}`}>{s.qty_remaining}</span>
                        <span className="text-xs text-slate-500 ml-1">{s.unit}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-600 text-xs">{s.qty_original}</td>
                      <td className="px-5 py-3.5">
                        {s.expiry_date ? (
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${isWarn ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-white/5 text-slate-400"}`}>
                            {isWarn && "⚠ "}{s.expiry_date}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{s.purchase_date || "—"}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{s.supplier || "—"}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => openDelete(s)}
                          className="opacity-0 group-hover:opacity-100 transition-all px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeDelete}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[#0e1428] border border-white/10 rounded-[24px] overflow-hidden shadow-2xl">
            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />

            <div className="px-6 pt-6 pb-5">
              {/* Icon + title */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">ยืนยันการลบ Lot</h2>
                  <p className="text-slate-500 text-xs mt-0.5">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
                </div>
              </div>

              {/* Lot info card */}
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4 mb-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Lot ID</span>
                  <span className="font-mono text-xs text-violet-400">{deleteModal.item.lot_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">สินค้า</span>
                  <span className="text-sm text-white font-medium text-right max-w-[60%] leading-snug">{deleteModal.item.product_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">คงเหลือ / ต้นฉบับ</span>
                  <span className="text-sm text-white">
                    <span className={deleteModal.item.qty_remaining > 0 ? "text-amber-400 font-bold" : "text-slate-400"}>
                      {deleteModal.item.qty_remaining}
                    </span>
                    <span className="text-slate-600"> / {deleteModal.item.qty_original} {deleteModal.item.unit}</span>
                  </span>
                </div>
                {deleteModal.item.expiry_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">หมดอายุ</span>
                    <span className="text-xs text-slate-400">{deleteModal.item.expiry_date}</span>
                  </div>
                )}
              </div>

              {/* Warning if stock remains */}
              {deleteModal.item.qty_remaining > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-4">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  <p className="text-xs text-amber-400 leading-relaxed">
                    Lot นี้ยังมีสินค้าคงเหลืออยู่ <span className="font-bold">{deleteModal.item.qty_remaining} {deleteModal.item.unit}</span> การลบจะทำให้สต๊อคหายไปทันที
                  </p>
                </div>
              )}

              {/* API error */}
              {deleteError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl mb-4">
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  <p className="text-xs text-red-400">{deleteError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={closeDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 border border-red-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      <span>กำลังลบ…</span>
                    </>
                  ) : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
