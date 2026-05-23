"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface StockItem {
  stock_id: string; product_name: string; category: string; brand: string;
  unit: string; lot_id: string; qty_received: number; qty_remaining: number;
  expiry_date: string; transfer_id: string; received_at: string;
}
interface AvailableProduct {
  product_id: string; product_name: string; category: string; unit: string; total_remaining: number;
}
interface Product {
  product_id: string; product_name: string; category: string; unit: string;
}
interface Doctor { name: string; license: string; }
interface UsageRecord {
  usage_id: string; product_name: string; unit: string; qty_used: number;
  lot_id: string; expiry_date: string; doctor: string; note: string;
  used_by: string; used_at: string; cost_per_unit: number; cost_total: number;
}
interface BranchOption { branchId: string; branchName: string; }

type ModalMode = "request" | "usage" | "edit" | "delete" | "deleteUsage" | null;

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 transition-all";

export default function BranchStockPage() {
  const router = useRouter();
  const [tab, setTab]                   = useState<"stock" | "history">("stock");
  const [role, setRole]                 = useState("");
  const [myBranchId, setMyBranchId]     = useState<string | null>(null);
  const [myBranchName, setMyBranchName] = useState<string | null>(null);
  const [branches, setBranches]         = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");

  // Stock tab
  const [stock, setStock]               = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError]     = useState("");

  // Usage tab
  const [usages, setUsages]             = useState<UsageRecord[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Form data (shared between request + usage modals)
  const [modal, setModal]               = useState<ModalMode>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [modalError, setModalError]     = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  // เบิกสินค้า
  const [products, setProducts]         = useState<Product[]>([]);
  const [reqProduct, setReqProduct]     = useState<Product | null>(null);
  const [reqQty, setReqQty]             = useState("");
  const [reqNote, setReqNote]           = useState("");

  // บันทึกการใช้ (matches original usage page)
  const [availProducts, setAvailProducts] = useState<AvailableProduct[]>([]);
  const [doctors, setDoctors]           = useState<Doctor[]>([]);
  const [useForm, setUseForm]           = useState({ product_id: "", qty_used: "", doctor: "", note: "" });

  // Edit stock
  const [editItem, setEditItem]         = useState<StockItem | null>(null);
  const [editQty, setEditQty]           = useState("");

  // Delete stock
  const [deleteItem, setDeleteItem]     = useState<StockItem | null>(null);

  // Delete usage (SA only)
  const [deleteUsage, setDeleteUsage]   = useState<UsageRecord | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState("");

  // ── Data loaders ────────────────────────────────────────────────────────────
  const loadStock = useCallback(async (branchId?: string) => {
    setStockLoading(true);
    try {
      const qs = branchId ? `?type=branch&branchId=${encodeURIComponent(branchId)}` : "?type=branch";
      const d  = await fetch(`/api/inv/stock${qs}`).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setStock(d.stock || []);
    } catch (e: any) { setStockError(e.message); }
    finally { setStockLoading(false); }
  }, []);

  const loadUsages = useCallback(async (branchId?: string) => {
    setUsageLoading(true);
    try {
      const qp = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
      const d  = await fetch(`/api/inv/usage${qp}`).then((r) => r.json());
      setUsages(d.usages || []);
    } catch { setUsages([]); }
    finally { setUsageLoading(false); }
  }, []);

  async function refreshAvailProducts(bid?: string) {
    const bp = bid ? `&branchId=${encodeURIComponent(bid)}` : "";
    const d  = await fetch(`/api/inv/usage?available=true&fresh=1${bp}`).then((r) => r.json());
    setAvailProducts(d.products || []);
  }
  async function refreshDoctors(bid?: string) {
    const qp = bid ? `?branchId=${encodeURIComponent(bid)}&fresh=1` : "?fresh=1";
    const d  = await fetch(`/api/inv/doctors${qp}`).then((r) => r.json());
    setDoctors(d.doctors || []);
  }

  useEffect(() => {
    async function init() {
      try {
        const auth = await fetch("/api/auth/branch-check").then((r) => r.json());
        setRole(auth.role); setMyBranchId(auth.branchId); setMyBranchName(auth.branchName);

        if (auth.role === "SUPER_ADMIN") {
          const branchData = await fetch("/api/inv/stock?type=branchList").then((r) => r.json());
          const list: BranchOption[] = (branchData.branches || []).map((b: any) => ({ branchId: b.branchId, branchName: b.branchName }));
          setBranches(list);
          if (list.length > 0) {
            setSelectedBranch(list[0].branchId);
            await Promise.all([loadStock(list[0].branchId), loadUsages(list[0].branchId)]);
          } else { setStockLoading(false); }
        } else {
          await Promise.all([loadStock(), loadUsages()]);
        }
      } catch (e: any) { setStockError(e.message); setStockLoading(false); }
    }
    init();
  }, [loadStock, loadUsages]);

  async function handleBranchChange(bid: string) {
    setSelectedBranch(bid); setStock([]); setUsages([]);
    await Promise.all([loadStock(bid), loadUsages(bid)]);
  }

  const effectiveBid  = selectedBranch || myBranchId || "";
  const effectiveName = role === "SUPER_ADMIN"
    ? branches.find((b) => b.branchId === selectedBranch)?.branchName || "เลือกสาขา"
    : myBranchName || "สาขา";
  const isSA = role === "SUPER_ADMIN";

  // ── เบิกสินค้า ──────────────────────────────────────────────────────────────
  async function openRequest() {
    setModalError(""); setModalSuccess(""); setReqProduct(null); setReqQty(""); setReqNote("");
    setModal("request");
    try {
      const d = await fetch("/api/inv/products").then((r) => r.json());
      setProducts((d.products || []).filter((p: Product) => p.product_id));
    } catch { setProducts([]); }
  }

  async function handleRequest() {
    if (!reqProduct || Number(reqQty) <= 0) { setModalError("กรุณาเลือกสินค้าและระบุจำนวน"); return; }
    setSubmitting(true); setModalError("");
    try {
      const branchName = branches.find((b) => b.branchId === effectiveBid)?.branchName || myBranchName || "";
      const res = await fetch("/api/inv/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: effectiveBid, branch_name: branchName,
          product_id: reqProduct.product_id, product_name: reqProduct.product_name,
          unit: reqProduct.unit, qty_requested: Number(reqQty), note: reqNote,
        }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setModalSuccess(`ส่งคำขอเบิก ${reqProduct.product_name} จำนวน ${reqQty} ${reqProduct.unit} แล้ว (${res.request_id})`);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── บันทึกการใช้ ─────────────────────────────────────────────────────────────
  async function openUsage() {
    setModalError(""); setModalSuccess("");
    setUseForm({ product_id: "", qty_used: "", doctor: "", note: "" });
    setModal("usage");
    const bp = effectiveBid ? `&branchId=${encodeURIComponent(effectiveBid)}` : "";
    const qp = effectiveBid ? `?branchId=${encodeURIComponent(effectiveBid)}` : "";
    const [pd, dd] = await Promise.all([
      fetch(`/api/inv/usage?available=true${bp}`).then((r) => r.json()),
      fetch(`/api/inv/doctors${qp}`).then((r) => r.json()),
    ]);
    setAvailProducts(pd.products || []);
    setDoctors(dd.doctors || []);
  }

  async function handleUsage(e: React.FormEvent) {
    e.preventDefault();
    const sel = availProducts.find((p) => p.product_id.toString() === useForm.product_id);
    if (!sel || Number(useForm.qty_used) <= 0) { setModalError("กรุณาเลือกสินค้าและระบุจำนวน"); return; }
    setSubmitting(true); setModalError("");
    try {
      const body: any = {
        product_id: sel.product_id, product_name: sel.product_name,
        category: sel.category, unit: sel.unit,
        qty_used: Number(useForm.qty_used), doctor: useForm.doctor, note: useForm.note,
      };
      if (effectiveBid) body.branch_id = effectiveBid;
      const res = await fetch("/api/inv/record-usage", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModalSuccess(`✓ บันทึกสำเร็จ · ${data.usage_id}`);
      setUseForm({ product_id: "", qty_used: "", doctor: "", note: "" });
      await Promise.all([
        loadStock(effectiveBid || undefined),
        loadUsages(effectiveBid || undefined),
        refreshAvailProducts(effectiveBid || undefined),
      ]);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── Edit / Delete stock ────────────────────────────────────────────────────
  function openEdit(item: StockItem) {
    setEditItem(item); setEditQty(String(item.qty_remaining)); setModalError(""); setModal("edit");
  }
  async function handleEditSave() {
    if (!editItem) return;
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty < 0) { setModalError("กรุณากรอกจำนวนที่ถูกต้อง"); return; }
    setSubmitting(true); setModalError("");
    try {
      const body: any = { stock_id: editItem.stock_id, qty_remaining: qty };
      if (selectedBranch) body.branch_id = selectedBranch;
      const res = await fetch("/api/inv/stock", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setStock((prev) => prev.map((s) => s.stock_id === editItem.stock_id ? { ...s, qty_remaining: qty } : s));
      setModal(null);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  function openDelete(item: StockItem) { setDeleteItem(item); setModalError(""); setModal("delete"); }
  async function handleDeleteStock() {
    if (!deleteItem) return;
    setSubmitting(true); setModalError("");
    try {
      const body: any = { stock_id: deleteItem.stock_id };
      if (selectedBranch) body.branch_id = selectedBranch;
      const res = await fetch("/api/inv/stock", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setStock((prev) => prev.filter((s) => s.stock_id !== deleteItem.stock_id));
      setModal(null);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── Delete usage ──────────────────────────────────────────────────────────
  function openDeleteUsage(u: UsageRecord) { setDeleteUsage(u); setDeleteError(""); setModal("deleteUsage"); }
  function closeDeleteUsage() { if (deleting) return; setDeleteUsage(null); setDeleteError(""); setModal(null); }
  async function handleDeleteUsage() {
    if (!deleteUsage) return;
    setDeleting(true); setDeleteError("");
    try {
      const body: any = { usage_id: deleteUsage.usage_id };
      if (effectiveBid) body.branch_id = effectiveBid;
      const res  = await fetch("/api/inv/usage", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ลบไม่สำเร็จ");
      setUsages((prev) => prev.filter((u) => u.usage_id !== deleteUsage.usage_id));
      setDeleteUsage(null); setModal(null);
    } catch (e: any) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  function closeModal() { if (submitting || deleting) return; setModal(null); setModalError(""); setModalSuccess(""); }

  // ── Derived ────────────────────────────────────────────────────────────────
  const today  = new Date();
  const warn30 = new Date(today); warn30.setDate(today.getDate() + 30);
  const withStock  = stock.filter((s) => s.qty_remaining > 0).length;
  const nearExpiry = stock.filter((s) => { const e = s.expiry_date ? new Date(s.expiry_date) : null; return e && e <= warn30 && s.qty_remaining > 0; }).length;
  const selProduct = availProducts.find((p) => p.product_id.toString() === useForm.product_id);
  const totalCost  = usages.reduce((s, u) => s + (u.cost_total || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center" style={{ boxShadow: "0 8px 24px rgba(139,92,246,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">สต๊อคสาขา</h1>
          <p className="text-slate-500 text-xs">{effectiveName}</p>
        </div>
        {nearExpiry > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/15 border border-red-500/20 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">ใกล้หมดอายุ {nearExpiry} รายการ</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={openRequest} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
            เบิกสินค้า
          </button>
          <button onClick={openUsage} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            บันทึกการใช้
          </button>
        </div>
      </header>

      {/* Branch switcher */}
      {isSA && branches.length > 0 && (
        <div className="relative z-10 border-b border-white/5 bg-white/[0.01] px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 uppercase tracking-wider">สาขา</span>
            <div className="flex gap-2 flex-wrap">
              {branches.map((b) => (
                <button key={b.branchId} onClick={() => handleBranchChange(b.branchId)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${selectedBranch === b.branchId ? "bg-gradient-to-r from-violet-500 to-purple-400 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"}`}>
                  {b.branchName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="relative z-10 border-b border-white/5 px-6">
        <div className="flex gap-1 pt-3">
          {([
            { key: "stock",   label: "สต๊อคสินค้า" },
            { key: "history", label: "ประวัติการใช้" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-all ${tab === key ? "text-white bg-white/[0.06] border border-b-0 border-white/10" : "text-slate-500 hover:text-slate-300"}`}>
              {label}
              {key === "history" && usages.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs">{usages.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-6">

        {/* ── Tab: สต๊อค ─────────────────────────────────────────────────── */}
        {tab === "stock" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
            <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">รายการทั้งหมด</p>
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
            {stockLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                      <th className="px-5 py-3.5">Stock ID</th>
                      <th className="px-5 py-3.5">สินค้า</th>
                      <th className="px-5 py-3.5">หมวด</th>
                      <th className="px-5 py-3.5 text-right">คงเหลือ</th>
                      <th className="px-5 py-3.5 text-right">รับมา</th>
                      <th className="px-5 py-3.5">Lot</th>
                      <th className="px-5 py-3.5">หมดอายุ</th>
                      <th className="px-5 py-3.5">รับเมื่อ</th>
                      {isSA && <th className="px-5 py-3.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.length === 0 ? (
                      <tr><td colSpan={isSA ? 9 : 8} className="px-5 py-14 text-center">
                        <p className="text-slate-600">ยังไม่มีสต๊อคในสาขานี้</p>
                        <p className="text-xs text-slate-700 mt-1">กด "เบิกสินค้า" เพื่อขอสินค้าจากคลังกลาง</p>
                      </td></tr>
                    ) : stock.map((s, idx) => {
                      const expDate = s.expiry_date ? new Date(s.expiry_date) : null;
                      const isWarn  = expDate ? expDate <= warn30 : false;
                      const isEmpty = s.qty_remaining === 0;
                      return (
                        <tr key={s.stock_id + idx} className={`border-t border-white/5 hover:bg-white/[0.03] transition-colors ${isEmpty ? "opacity-30" : ""}`}>
                          <td className="px-5 py-3.5 font-mono text-xs text-violet-400">{s.stock_id}</td>
                          <td className="px-5 py-3.5"><p className="text-white font-medium">{s.product_name}</p>{s.brand && <p className="text-xs text-slate-500">{s.brand}</p>}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{s.category || "—"}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-bold text-base ${isEmpty ? "text-slate-600" : isWarn ? "text-amber-400" : "text-emerald-400"}`}>{s.qty_remaining}</span>
                            <span className="text-xs text-slate-500 ml-1">{s.unit}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-600 text-xs">{s.qty_received}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{s.lot_id || "—"}</td>
                          <td className="px-5 py-3.5">
                            {s.expiry_date ? (
                              <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${isWarn ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-white/5 text-slate-400"}`}>
                                {isWarn && "⚠ "}{s.expiry_date}
                              </span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">{s.received_at || "—"}</td>
                          {isSA && (
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button onClick={() => openEdit(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all">แก้ไข</button>
                                <button onClick={() => openDelete(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">ลบ</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: ประวัติการใช้ ──────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-white font-semibold">ประวัติการใช้สินค้า</h2>
              <div className="flex items-center gap-4">
                {totalCost > 0 && (
                  <span className="text-sm text-amber-400 font-semibold">
                    ต้นทุนรวม ฿{totalCost.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                )}
                <span className="text-xs text-slate-500">{usages.length} รายการ</span>
              </div>
            </div>
            {usageLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
              </div>
            ) : usages.length === 0 ? (
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
                      {isSA && <th className="px-5 py-3.5" />}
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
                        {isSA && (
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => openDeleteUsage(u)} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all">ลบ</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ══════════════════════ MODALS ══════════════════════════════════════════ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

          {/* เบิกสินค้า */}
          {modal === "request" && (
            <div className="relative w-full max-w-md bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center" style={{ boxShadow: "0 6px 20px rgba(139,92,246,0.35)" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">เบิกสินค้าจากคลังกลาง</h2>
                    <p className="text-slate-500 text-xs">ส่งคำขอ — Admin จะอนุมัติและโอนสินค้า</p>
                  </div>
                  <button onClick={closeModal} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                {modalSuccess ? (
                  <>
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400 text-sm">{modalSuccess}</div>
                    <button onClick={closeModal} className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ปิด</button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">สินค้า</label>
                      <select value={reqProduct?.product_id || ""} onChange={(e) => setReqProduct(products.find((p) => p.product_id.toString() === e.target.value) || null)} className={selectCls}>
                        <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                        {products.map((p) => <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">{p.product_name} {p.unit ? `(${p.unit})` : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">จำนวนที่ขอ</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} value={reqQty} onChange={(e) => setReqQty(e.target.value)} placeholder="0" className={inputCls} />
                        {reqProduct?.unit && <span className="text-sm text-slate-500 whitespace-nowrap">{reqProduct.unit}</span>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">หมายเหตุ <span className="text-slate-600">(ไม่บังคับ)</span></label>
                      <input type="text" value={reqNote} onChange={(e) => setReqNote(e.target.value)} placeholder="เหตุผลการขอเบิก..." className={inputCls} />
                    </div>
                    {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                      <button onClick={handleRequest} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }}>
                        {submitting ? "กำลังส่ง..." : "ส่งคำขอเบิก"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* บันทึกการใช้ — เหมือนหน้า usage เดิม */}
          {modal === "usage" && (
            <div className="relative w-full max-w-lg bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-400 flex items-center justify-center" style={{ boxShadow: "0 6px 20px rgba(168,85,247,0.3)" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">บันทึกการใช้สินค้า</h2>
                    <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/20 text-purple-400 text-xs rounded-lg">FIFO อัตโนมัติ</span>
                  </div>
                  <button onClick={closeModal} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>

                {modalSuccess && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl mb-4">{modalSuccess}</p>}

                <form onSubmit={handleUsage} className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">สินค้า *</label>
                    <select
                      value={useForm.product_id}
                      onChange={(e) => setUseForm({ ...useForm, product_id: e.target.value })}
                      onFocus={() => refreshAvailProducts(effectiveBid || undefined)}
                      required className={selectCls}
                    >
                      <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                      {availProducts.map((p) => (
                        <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">
                          {p.product_name} — คงเหลือ {p.total_remaining} {p.unit}
                        </option>
                      ))}
                    </select>
                    {availProducts.length === 0 && (
                      <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                        <p className="text-xs text-amber-400">ไม่มีสินค้าในสต๊อคสาขา — ลองเบิกสินค้าจากคลังกลางก่อน</p>
                      </div>
                    )}
                    {selProduct && (
                      <div className="mt-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2">
                        <p className="text-xs text-purple-400">คงเหลือในสต๊อค: <span className="font-semibold">{selProduct.total_remaining} {selProduct.unit}</span></p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">จำนวนที่ใช้ ({selProduct?.unit || "หน่วย"}) *</label>
                      <input
                        type="number" min="1" max={selProduct?.total_remaining} required
                        value={useForm.qty_used} onChange={(e) => setUseForm({ ...useForm, qty_used: e.target.value })}
                        placeholder="0" className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">แพทย์ผู้ใช้</label>
                      {doctors.length > 0 ? (
                        <select
                          value={useForm.doctor} onChange={(e) => setUseForm({ ...useForm, doctor: e.target.value })}
                          onFocus={() => refreshDoctors(effectiveBid || undefined)}
                          className={selectCls}
                        >
                          <option value="" className="bg-[#0d1526]">— เลือกแพทย์ —</option>
                          {doctors.map((d) => (
                            <option key={d.name} value={d.name} className="bg-[#0d1526]">
                              {d.name}{d.license ? ` (${d.license})` : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input type="text" value={useForm.doctor} onChange={(e) => setUseForm({ ...useForm, doctor: e.target.value })} placeholder="ชื่อแพทย์ (ถ้ามี)" className={inputCls} />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
                    <input type="text" value={useForm.note} onChange={(e) => setUseForm({ ...useForm, note: e.target.value })} placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
                  </div>

                  {modalError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{modalError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                    <button type="submit" disabled={submitting || availProducts.length === 0}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-violet-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
                      style={{ boxShadow: "0 4px 20px rgba(168,85,247,0.3)" }}>
                      {submitting ? "กำลังบันทึก..." : "บันทึกการใช้"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit qty */}
          {modal === "edit" && editItem && (
            <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">แก้ไขจำนวนคงเหลือ</h2>
                    <p className="text-slate-500 text-xs truncate max-w-[200px]">{editItem.product_name}</p>
                  </div>
                  <button onClick={closeModal} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-xs text-slate-500">Stock ID:</span>
                  <span className="font-mono text-xs text-violet-400">{editItem.stock_id}</span>
                  <span className="ml-auto text-xs text-slate-500">ปัจจุบัน:</span>
                  <span className="text-xs font-bold text-emerald-400">{editItem.qty_remaining} {editItem.unit}</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1.5">จำนวนคงเหลือใหม่</label>
                  <input type="number" min={0} value={editQty} onChange={(e) => setEditQty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEditSave()} className={inputCls} autoFocus />
                  {editItem.unit && <p className="text-xs text-slate-600 mt-1.5">หน่วย: {editItem.unit}</p>}
                </div>
                {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                  <button onClick={handleEditSave} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }}>
                    {submitting ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete stock */}
          {modal === "delete" && deleteItem && (
            <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </div>
                  <div className="flex-1"><h2 className="text-white font-semibold text-sm">ยืนยันการลบสต๊อค</h2><p className="text-slate-500 text-xs">ไม่สามารถเรียกคืนได้</p></div>
                  <button onClick={closeModal} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5 space-y-1.5">
                  <p className="text-white text-sm font-medium">{deleteItem.product_name}</p>
                  {deleteItem.brand && <p className="text-xs text-slate-500">{deleteItem.brand}</p>}
                  <div className="flex gap-4 pt-1">
                    <span className="text-xs text-slate-500">Stock ID: <span className="font-mono text-violet-400">{deleteItem.stock_id}</span></span>
                    <span className="text-xs text-slate-500">คงเหลือ: <span className="text-emerald-400 font-medium">{deleteItem.qty_remaining} {deleteItem.unit}</span></span>
                  </div>
                </div>
                {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                  <button onClick={handleDeleteStock} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-all">
                    {submitting ? "กำลังลบ..." : "ลบรายการนี้"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete usage (SA) — เหมือน modal ของหน้า usage เดิม */}
          {modal === "deleteUsage" && deleteUsage && (
            <div className="relative w-full max-w-sm bg-[#0d1526] border border-white/10 rounded-[24px] p-6 shadow-2xl" style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent" />
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/20 mx-auto mb-4">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-white font-bold text-center text-base mb-1">ยืนยันการลบรายการ</h3>
              <p className="text-slate-500 text-xs text-center mb-5">รายการนี้จะถูกลบออกจากระบบ</p>
              <div className="bg-white/[0.04] border border-white/8 rounded-2xl px-5 py-4 space-y-2.5 mb-4">
                <div className="flex justify-between items-center"><span className="text-xs text-slate-500">Usage ID</span><span className="font-mono text-xs text-purple-400">{deleteUsage.usage_id}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-slate-500">สินค้า</span><span className="text-sm text-white font-medium">{deleteUsage.product_name}</span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-slate-500">จำนวน</span><span className="text-sm font-bold text-white">{deleteUsage.qty_used} <span className="text-xs text-slate-400 font-normal">{deleteUsage.unit}</span></span></div>
                <div className="flex justify-between items-center"><span className="text-xs text-slate-500">Lot</span><span className="font-mono text-xs text-slate-400">{deleteUsage.lot_id}</span></div>
              </div>
              <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
                <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-xs text-amber-400 leading-relaxed">การลบจะคืน qty กลับ INV_Stock ของ lot นี้</p>
              </div>
              {deleteError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl mb-4">{deleteError}</p>}
              <div className="flex gap-3">
                <button onClick={closeDeleteUsage} disabled={deleting} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-all">ยกเลิก</button>
                <button onClick={handleDeleteUsage} disabled={deleting} className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>
                  {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
