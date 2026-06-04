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

interface PO {
  po_id: string;
  product_id: string;
  product_name: string;
  category: string;
  brand: string;
  unit: string;
  unit_pkg: string;
  qty_per_pkg: string;
  qty_ordered: string;
  qty_unit: string;
  cost_per_unit: string;
  cost_total: string;
  supplier_name: string;
  payment_method: string;
  installments_count: string;
  amount_per_installment: string;
  paid_amount: string;
  outstanding_amount: string;
  expected_delivery: string;
  received_date: string;
  lot_id: string;
  expiry_date: string;
  status: string;
  note: string;
  created_by: string;
  created_at: string;
  approved_by: string;
  approved_at: string;
  payment_config: string;
}

type Tab          = "create" | "list";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all appearance-none";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">{children}</label>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "รอดำเนินการ",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  APPROVED:  { label: "อนุมัติแล้ว",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  RECEIVED:  { label: "รับสินค้าแล้ว", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  CANCELLED: { label: "ยกเลิกแล้ว",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
};

const PAYMENT_LABELS: Record<string, string> = {
  FULL:        "ชำระเต็มจำนวน",
  NET:         "เครดิต (Net)",
  EQUAL:       "ผ่อนเท่าๆ กัน",
  DEPOSIT:     "มัดจำ",
  CUSTOM:      "กำหนดเอง",
  INSTALLMENT: "ผ่อนชำระ",
  PARTIAL:     "จ่ายบางส่วน",
};

const PAYMENT_METHODS = [
  { value: "FULL",    label: "เต็มจำนวน",     desc: "ชำระทันทีเมื่ออนุมัติ" },
  { value: "NET",     label: "เครดิต",        desc: "Net 30 / 60 / 90 วัน" },
  { value: "EQUAL",   label: "ผ่อนเท่าๆ กัน", desc: "หารเฉลี่ยตามงวด" },
  { value: "DEPOSIT", label: "มัดจำ",          desc: "จ่ายมัดจำ + ส่วนเหลือ" },
  { value: "CUSTOM",  label: "กำหนดเอง",       desc: "ระบุแต่ละงวดเอง" },
] as const;

function parseConfig(raw: string) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

export default function InvPurchasePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab]               = useState<Tab>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [products, setProducts]     = useState<Product[]>([]);
  const [suppliers, setSuppliers]   = useState<string[]>([]);
  const [pos, setPos]               = useState<PO[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [globalMsg, setGlobalMsg]   = useState({ type: "", text: "" });

  const [approveModal, setApproveModal] = useState<PO | null>(null);
  const [stockInModal, setStockInModal] = useState<PO | null>(null);
  const [cancelModal, setCancelModal]   = useState<PO | null>(null);
  const [deleteModal, setDeleteModal]   = useState<PO | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg]         = useState("");
  const [stockInForm, setStockInForm]   = useState({ expiry_date: "", note: "" });
  const [cancelNote, setCancelNote]     = useState("");

  const [form, setForm] = useState({
    product_id: "", qty_ordered: "", cost_total: "",
    supplier_name: "",
    payment_method: "FULL",
    net_days: "30",
    installments_count: "3",
    interval_months: "1",
    deposit_pct: "30",
    expected_delivery: "", note: "",
  });
  const [customRows, setCustomRows] = useState<{ due_date: string; amount: string }[]>([
    { due_date: "", amount: "" },
  ]);

  useEffect(() => {
    async function init() {
      try {
        const [authRes, prodRes, supRes, poRes] = await Promise.all([
          fetch("/api/auth/branch-check"),
          fetch("/api/inv/products"),
          fetch("/api/inv/suppliers"),
          fetch("/api/inv/po"),
        ]);
        const auth = await authRes.json();
        if (auth.role !== "SUPER_ADMIN") { router.replace("/ERP/home-demo"); return; }
        const prods: Product[] = (await prodRes.json()).products || [];
        setProducts(prods);
        setSuppliers((await supRes.json()).suppliers || []);
        setPos((await poRes.json()).pos || []);

        const qProductId = searchParams.get("productId");
        if (qProductId) {
          const match = prods.find((p) => p.product_id.toString() === qProductId);
          if (match) { setForm((f) => ({ ...f, product_id: match.product_id.toString() })); setTab("create"); }
        }
      } catch (e: any) {
        setGlobalMsg({ type: "error", text: e.message });
      } finally { setLoading(false); }
    }
    init();
  }, [router, searchParams]);

  const selectedProduct = products.find((p) => p.product_id.toString() === form.product_id);
  const calcQtyUnit     = selectedProduct ? Number(form.qty_ordered) * selectedProduct.qty_per_pkg : 0;
  const costTotalNum    = Number(form.cost_total) || 0;

  // computed per method
  const equalAmtPerInst = form.payment_method === "EQUAL" && Number(form.installments_count) > 0
    ? Math.round(costTotalNum / Number(form.installments_count)) : 0;
  const depositAmt   = Math.round(costTotalNum * (Number(form.deposit_pct) || 0) / 100);
  const remainderAmt = costTotalNum - depositAmt;
  const customTotal  = customRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const customDiff   = costTotalNum - customTotal;

  const netDueLabel = (() => {
    if (form.payment_method !== "NET" || !form.net_days || !costTotalNum) return "";
    const d = new Date(); d.setDate(d.getDate() + Number(form.net_days));
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  })();

  function resetForm() {
    setForm({ product_id: "", qty_ordered: "", cost_total: "", supplier_name: "",
      payment_method: "FULL", net_days: "30", installments_count: "3",
      interval_months: "1", deposit_pct: "30", expected_delivery: "", note: "" });
    setCustomRows([{ due_date: "", amount: "" }]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;

    if (form.payment_method === "CUSTOM") {
      if (customRows.some((r) => !r.due_date || !r.amount))
        return setGlobalMsg({ type: "error", text: "กรุณากรอกวันครบกำหนดและจำนวนเงินทุกงวด" });
      if (Math.abs(customDiff) >= 1)
        return setGlobalMsg({ type: "error", text: `ยอดรวมงวดต่างจากราคา ${Math.abs(customDiff).toLocaleString()} บาท` });
    }

    setSubmitting(true);
    setGlobalMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/inv/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id:          selectedProduct.product_id,
          product_name:        selectedProduct.product_name,
          category:            selectedProduct.category,
          brand:               selectedProduct.brand,
          unit:                selectedProduct.unit,
          unit_pkg:            selectedProduct.unit_pkg,
          qty_per_pkg:         selectedProduct.qty_per_pkg,
          qty_ordered:         Number(form.qty_ordered),
          cost_total:          Number(form.cost_total),
          supplier_name:       form.supplier_name,
          payment_method:      form.payment_method,
          net_days:            Number(form.net_days),
          installments_count:  Number(form.installments_count),
          interval_months:     Number(form.interval_months),
          deposit_pct:         Number(form.deposit_pct),
          custom_installments: form.payment_method === "CUSTOM"
            ? customRows.map((r) => ({ due_date: r.due_date, amount: Number(r.amount) }))
            : [],
          expected_delivery:   form.expected_delivery,
          note:                form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGlobalMsg({ type: "success", text: `สร้าง PO สำเร็จ: ${data.po_id}` });
      resetForm();
      const reload = await fetch("/api/inv/po");
      setPos((await reload.json()).pos || []);
      setTab("list");
      setStatusFilter("PENDING");
    } catch (e: any) {
      setGlobalMsg({ type: "error", text: e.message });
    } finally { setSubmitting(false); }
  }

  async function doApprove() {
    if (!approveModal) return;
    setModalLoading(true); setModalMsg("");
    try {
      const res  = await fetch("/api/inv/po", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: approveModal.po_id, action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const lc = data.liabilities_created ?? 0;
      setModalMsg(lc > 0 ? `อนุมัติสำเร็จ · สร้างตารางชำระ ${lc} งวด` : "อนุมัติสำเร็จ");
      const reload = await fetch("/api/inv/po");
      setPos((await reload.json()).pos || []);
      setTimeout(() => setApproveModal(null), 1200);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); }
    finally { setModalLoading(false); }
  }

  async function doStockIn() {
    if (!stockInModal) return;
    if (!stockInForm.expiry_date) { setModalMsg("❌ กรุณาระบุวันหมดอายุ"); return; }
    setModalLoading(true); setModalMsg("");
    try {
      const res  = await fetch("/api/inv/po", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: stockInModal.po_id, action: "stock-in",
          expiry_date: stockInForm.expiry_date, note: stockInForm.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModalMsg(`รับสินค้าสำเร็จ · Lot: ${data.lot_id}`);
      const reload = await fetch("/api/inv/po");
      setPos((await reload.json()).pos || []);
      setTimeout(() => { setStockInModal(null); setStockInForm({ expiry_date: "", note: "" }); }, 1200);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); }
    finally { setModalLoading(false); }
  }

  async function doCancel() {
    if (!cancelModal) return;
    setModalLoading(true); setModalMsg("");
    try {
      const res  = await fetch("/api/inv/po", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: cancelModal.po_id, action: "cancel", note: cancelNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModalMsg("ยกเลิก PO สำเร็จ");
      const reload = await fetch("/api/inv/po");
      setPos((await reload.json()).pos || []);
      setTimeout(() => { setCancelModal(null); setCancelNote(""); }, 800);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); }
    finally { setModalLoading(false); }
  }

  async function doDelete() {
    if (!deleteModal) return;
    setModalLoading(true); setModalMsg("");
    try {
      const res  = await fetch("/api/inv/po", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_id: deleteModal.po_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setModalMsg("ลบสำเร็จ");
      setPos((prev) => prev.filter((p) => p.po_id !== deleteModal.po_id));
      setTimeout(() => setDeleteModal(null), 800);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); }
    finally { setModalLoading(false); }
  }

  const filteredPos = statusFilter === "ALL" ? pos : pos.filter((p) => p.status === statusFilter);
  const statusCounts = {
    ALL: pos.length,
    PENDING:   pos.filter((p) => p.status === "PENDING").length,
    APPROVED:  pos.filter((p) => p.status === "APPROVED").length,
    RECEIVED:  pos.filter((p) => p.status === "RECEIVED").length,
    CANCELLED: pos.filter((p) => p.status === "CANCELLED").length,
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">การจัดซื้อ</h1>
          <p className="text-slate-500 text-xs">Purchase Order — Central Warehouse</p>
        </div>
        <button onClick={() => router.push("/ERP/inv/liabilities")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25 text-sm font-medium transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          หนี้สิน
        </button>
      </header>

      <div className="relative z-10 px-6 pt-5 max-w-5xl mx-auto">
        <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-2xl p-1 w-fit">
          {([["list", "รายการ PO"], ["create", "สร้าง PO ใหม่"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-emerald-500 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-5 space-y-5">

        {globalMsg.text && (
          <div className={`px-4 py-3 rounded-xl border text-sm ${globalMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {globalMsg.text}
          </div>
        )}

        {searchParams.get("productName") && tab === "create" && (
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-500/10 border border-blue-500/20 rounded-[18px]">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-blue-400 text-sm">สั่งซื้อจากคำขอสาขา — สินค้า <span className="font-semibold">{searchParams.get("productName")}</span></p>
          </div>
        )}

        {/* ═══ CREATE TAB ══════════════════════════════════════════════════ */}
        {tab === "create" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <h2 className="text-white font-semibold mb-5">สร้าง Purchase Order ใหม่</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="md:col-span-2">
                  <Label>สินค้า *</Label>
                  <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required className={selectCls}>
                    <option value="">— เลือกสินค้า —</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.product_name}{p.brand ? ` (${p.brand})` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <p className="text-xs text-emerald-400 mt-1.5">
                      หน่วย: {selectedProduct.unit} · บรรจุ {selectedProduct.qty_per_pkg} {selectedProduct.unit}/{selectedProduct.unit_pkg}
                    </p>
                  )}
                </div>

                <div>
                  <Label>จำนวน ({selectedProduct?.unit_pkg || "หน่วยบรรจุ"}) *</Label>
                  <input type="number" min="1" value={form.qty_ordered}
                    onChange={(e) => setForm({ ...form, qty_ordered: e.target.value })}
                    required placeholder="0" className={inputCls} />
                  {calcQtyUnit > 0 && <p className="text-xs text-emerald-400 mt-1.5">= {calcQtyUnit} {selectedProduct?.unit}</p>}
                </div>

                <div>
                  <Label>ราคารวม (บาท) *</Label>
                  <input type="number" min="0" value={form.cost_total}
                    onChange={(e) => setForm({ ...form, cost_total: e.target.value })}
                    required placeholder="0" className={inputCls} />
                </div>

                <div>
                  <Label>ผู้จัดจำหน่าย</Label>
                  <select value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} className={selectCls}>
                    <option value="">— เลือก Supplier —</option>
                    {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <Label>กำหนดส่งสินค้า</Label>
                  <input type="date" value={form.expected_delivery}
                    onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
                    className={inputCls} style={{ colorScheme: "dark" }} />
                </div>

                {/* ── Payment Method ───────────────────────────────────── */}
                <div className="md:col-span-2">
                  <Label>รูปแบบการชำระเงิน</Label>

                  {/* Method selector */}
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button type="button" key={m.value}
                        onClick={() => setForm({ ...form, payment_method: m.value })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.payment_method === m.value
                            ? "bg-emerald-500/15 border-emerald-500/40"
                            : "bg-white/[0.03] border-white/10 hover:border-white/20"
                        }`}>
                        <p className={`text-xs font-semibold ${form.payment_method === m.value ? "text-emerald-400" : "text-slate-300"}`}>{m.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Config panel */}
                  {form.payment_method === "NET" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-36">
                          <Label>ชำระภายใน (วัน)</Label>
                          <input type="number" min="1" value={form.net_days}
                            onChange={(e) => setForm({ ...form, net_days: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div className="flex gap-2 mt-5">
                          {["30", "45", "60", "90"].map((d) => (
                            <button type="button" key={d}
                              onClick={() => setForm({ ...form, net_days: d })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                form.net_days === d
                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                              }`}>
                              Net{d}
                            </button>
                          ))}
                        </div>
                      </div>
                      {netDueLabel && (
                        <p className="text-xs text-emerald-400">
                          ครบกำหนด: {netDueLabel} · ยอดชำระ {costTotalNum.toLocaleString()} บาท
                        </p>
                      )}
                    </div>
                  )}

                  {form.payment_method === "EQUAL" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>จำนวนงวด</Label>
                          <input type="number" min="1" max="60" value={form.installments_count}
                            onChange={(e) => setForm({ ...form, installments_count: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div>
                          <Label>ทุกกี่เดือน</Label>
                          <input type="number" min="1" max="12" value={form.interval_months}
                            onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
                            className={inputCls} />
                        </div>
                      </div>
                      {equalAmtPerInst > 0 && (
                        <p className="text-xs text-emerald-400">
                          งวดละ ≈ {equalAmtPerInst.toLocaleString()} บาท × {form.installments_count} งวด
                          {Number(form.interval_months) > 1 && ` (ทุก ${form.interval_months} เดือน)`}
                        </p>
                      )}
                    </div>
                  )}

                  {form.payment_method === "DEPOSIT" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>มัดจำ (%)</Label>
                          <input type="number" min="1" max="99" value={form.deposit_pct}
                            onChange={(e) => setForm({ ...form, deposit_pct: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div>
                          <Label>ชำระส่วนที่เหลือใน (เดือน)</Label>
                          <input type="number" min="1" value={form.interval_months}
                            onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
                            className={inputCls} />
                        </div>
                      </div>
                      {costTotalNum > 0 && (
                        <div className="flex items-center gap-4 text-xs">
                          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 px-3 py-1.5 rounded-lg">
                            มัดจำ {form.deposit_pct}% = {depositAmt.toLocaleString()} บาท (วันนี้)
                          </span>
                          <span className="text-slate-500">+</span>
                          <span className="bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg">
                            ส่วนที่เหลือ {remainderAmt.toLocaleString()} บาท (ใน {form.interval_months} เดือน)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {form.payment_method === "CUSTOM" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="space-y-2">
                        {customRows.map((row, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-10 flex-shrink-0">งวด {i + 1}</span>
                            <input type="date" value={row.due_date}
                              onChange={(e) => setCustomRows((prev) => prev.map((r, j) => j === i ? { ...r, due_date: e.target.value } : r))}
                              className={`${inputCls} flex-1`} style={{ colorScheme: "dark" }} />
                            <input type="number" min="0" placeholder="จำนวนเงิน (บาท)" value={row.amount}
                              onChange={(e) => setCustomRows((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                              className={`${inputCls} w-40`} />
                            {customRows.length > 1 && (
                              <button type="button"
                                onClick={() => setCustomRows((prev) => prev.filter((_, j) => j !== i))}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button"
                        onClick={() => setCustomRows((prev) => [...prev, { due_date: "", amount: "" }])}
                        className="text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-all">
                        + เพิ่มงวด
                      </button>
                      {costTotalNum > 0 && (
                        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                          Math.abs(customDiff) < 1
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        }`}>
                          <span>ยอดรวม {customTotal.toLocaleString()} / {costTotalNum.toLocaleString()} บาท</span>
                          {Math.abs(customDiff) >= 1 && (
                            <span>· {customDiff > 0 ? `ยังขาด ${customDiff.toLocaleString()}` : `เกิน ${Math.abs(customDiff).toLocaleString()}`} บาท</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label>หมายเหตุ</Label>
                  <input type="text" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all shadow-lg"
                  style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                  {submitting ? "กำลังสร้าง..." : "สร้าง PO (สถานะ: รอดำเนินการ)"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ═══ LIST TAB ════════════════════════════════════════════════════ */}
        {tab === "list" && (
          <>
            <div className="flex gap-2 flex-wrap">
              {(["ALL", "PENDING", "APPROVED", "RECEIVED", "CANCELLED"] as StatusFilter[]).map((s) => {
                const cfg   = s === "ALL" ? null : STATUS_CONFIG[s];
                const count = statusCounts[s];
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 ${
                      active
                        ? s === "ALL" ? "bg-white/10 border-white/20 text-white" : `${cfg!.bg} ${cfg!.border} ${cfg!.color}`
                        : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"
                    }`}>
                    <span>{s === "ALL" ? "ทั้งหมด" : cfg!.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-lg ${active ? "bg-white/20" : "bg-white/5"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              {filteredPos.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-600">ไม่มีรายการในสถานะนี้</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredPos.map((po) => {
                    const cfg           = STATUS_CONFIG[po.status] || STATUS_CONFIG["PENDING"];
                    const isInstallment = po.payment_method !== "FULL";
                    const paidPct       = Number(po.cost_total) > 0
                      ? Math.round((Number(po.paid_amount) / Number(po.cost_total)) * 100) : 0;
                    const cfg2 = parseConfig(po.payment_config);

                    return (
                      <div key={po.po_id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-emerald-400">{po.po_id}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span>
                              {isInstallment && (
                                <span className="text-xs px-2 py-0.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                                  {PAYMENT_LABELS[po.payment_method] || po.payment_method}
                                  {po.payment_method === "NET" && cfg2.net_days ? ` · Net${cfg2.net_days}` : ""}
                                  {po.payment_method === "EQUAL" && cfg2.installments ? ` · ${cfg2.installments} งวด` : ""}
                                  {po.payment_method === "DEPOSIT" && cfg2.deposit_pct ? ` · ${cfg2.deposit_pct}%` : ""}
                                  {po.payment_method === "CUSTOM" && cfg2.installments ? ` · ${cfg2.installments.length} งวด` : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-white font-semibold text-sm truncate">{po.product_name}</p>
                            <div className="flex gap-4 text-xs text-slate-500 flex-wrap">
                              <span>{po.qty_unit} {po.unit}</span>
                              <span className="text-slate-300 font-medium">{Number(po.cost_total).toLocaleString()} บาท</span>
                              {po.supplier_name && <span>{po.supplier_name}</span>}
                              {po.expected_delivery && <span>กำหนดส่ง: {po.expected_delivery}</span>}
                              {po.received_date && <span>รับวันที่: {po.received_date}</span>}
                              {po.lot_id && <span className="font-mono text-slate-600">Lot: {po.lot_id}</span>}
                            </div>
                            {isInstallment && Number(po.cost_total) > 0 && (
                              <div className="mt-1.5">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>ชำระแล้ว {Number(po.paid_amount).toLocaleString()} บาท</span>
                                  <span>คงเหลือ {Number(po.outstanding_amount).toLocaleString()} บาท</span>
                                </div>
                                <div className="h-1 bg-white/10 rounded-full overflow-hidden w-48">
                                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 flex-shrink-0 flex-wrap">
                            {po.status === "PENDING" && (
                              <>
                                <button onClick={() => { setApproveModal(po); setModalMsg(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 text-xs font-medium transition-all">อนุมัติ</button>
                                <button onClick={() => { setCancelModal(po); setModalMsg(""); setCancelNote(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">ยกเลิก</button>
                                <button onClick={() => { setDeleteModal(po); setModalMsg(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-600 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">ลบ</button>
                              </>
                            )}
                            {po.status === "APPROVED" && (
                              <>
                                <button onClick={() => { setStockInModal(po); setModalMsg(""); setStockInForm({ expiry_date: "", note: "" }); }}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-all">รับสินค้า</button>
                                <button onClick={() => { setCancelModal(po); setModalMsg(""); setCancelNote(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">ยกเลิก</button>
                              </>
                            )}
                            {po.status === "CANCELLED" && (
                              <button onClick={() => { setDeleteModal(po); setModalMsg(""); }}
                                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-600 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">ลบ</button>
                            )}
                            {po.status === "RECEIVED" && isInstallment && (
                              <button onClick={() => router.push("/ERP/inv/liabilities")}
                                className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/25 text-xs font-medium transition-all">ดูการชำระ</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ═══ APPROVE MODAL ═════════════════════════════════════════════════ */}
      {approveModal && (() => {
        const cfg2   = parseConfig(approveModal.payment_config);
        const method = approveModal.payment_method;
        const total  = Number(approveModal.cost_total);
        return (
          <Modal title="ยืนยันอนุมัติ PO" onClose={() => !modalLoading && setApproveModal(null)}>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
              <Row label="PO ID"    value={<span className="font-mono text-blue-400">{approveModal.po_id}</span>} />
              <Row label="สินค้า"  value={<span className="text-white font-semibold">{approveModal.product_name}</span>} />
              <Row label="จำนวน"   value={`${approveModal.qty_unit} ${approveModal.unit}`} />
              <Row label="ราคารวม" value={`${total.toLocaleString()} บาท`} />
              <Row label="Supplier" value={approveModal.supplier_name || "—"} />
              <Row label="การชำระ" value={PAYMENT_LABELS[method] || method} />
            </div>

            {/* Payment summary per method */}
            {method !== "FULL" && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 mb-4 space-y-1 text-xs text-violet-300">
                {method === "NET" && (
                  <p>ชำระ {total.toLocaleString()} บาท ภายใน <span className="font-semibold text-violet-200">Net {cfg2.net_days ?? 30} วัน</span> (1 งวด)</p>
                )}
                {(method === "EQUAL" || method === "INSTALLMENT") && (() => {
                  const count = cfg2.installments ?? Number(approveModal.installments_count);
                  const im    = cfg2.interval_months ?? 1;
                  const amt   = count > 0 ? Math.round(total / count) : 0;
                  return <p>ผ่อน <span className="font-semibold text-violet-200">{count} งวด</span> · งวดละ ≈ {amt.toLocaleString()} บาท · ทุก {im} เดือน</p>;
                })()}
                {method === "DEPOSIT" && (() => {
                  const pct    = cfg2.deposit_pct ?? 30;
                  const dAmt   = Math.round(total * pct / 100);
                  const remain = total - dAmt;
                  return (
                    <>
                      <p>มัดจำ <span className="font-semibold text-violet-200">{pct}% = {dAmt.toLocaleString()} บาท</span> (วันนี้)</p>
                      <p>ส่วนที่เหลือ <span className="font-semibold">{remain.toLocaleString()} บาท</span> ใน {cfg2.interval_months ?? 1} เดือน</p>
                    </>
                  );
                })()}
                {(method === "CUSTOM" || method === "PARTIAL") && Array.isArray(cfg2.installments) && cfg2.installments.length > 0 && (
                  <div className="space-y-0.5">
                    <p className="font-semibold text-violet-200 mb-1">กำหนดชำระ {cfg2.installments.length} งวด</p>
                    {cfg2.installments.map((item: any, i: number) => (
                      <p key={i}>งวด {i + 1}: {new Date(item.due_date).toLocaleDateString("th-TH")} — {Number(item.amount).toLocaleString()} บาท</p>
                    ))}
                  </div>
                )}
                <p className="text-violet-400/70 text-[10px] mt-1">ระบบจะสร้างตารางชำระเงินใน Liabilities อัตโนมัติ</p>
              </div>
            )}

            {modalMsg && <ModalMsg msg={modalMsg} />}
            <ModalActions onCancel={() => setApproveModal(null)} onConfirm={doApprove}
              loading={modalLoading} confirmLabel="อนุมัติ" confirmClass="bg-gradient-to-r from-blue-500 to-indigo-400" />
          </Modal>
        );
      })()}

      {/* ═══ STOCK-IN MODAL ════════════════════════════════════════════════ */}
      {stockInModal && (
        <Modal title="รับสินค้าเข้าคลัง" onClose={() => !modalLoading && setStockInModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"   value={<span className="font-mono text-emerald-400">{stockInModal.po_id}</span>} />
            <Row label="สินค้า" value={<span className="text-white font-semibold">{stockInModal.product_name}</span>} />
            <Row label="จำนวน"  value={`${stockInModal.qty_unit} ${stockInModal.unit}`} />
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <Label>วันหมดอายุ *</Label>
              <input type="date" value={stockInForm.expiry_date}
                onChange={(e) => setStockInForm({ ...stockInForm, expiry_date: e.target.value })}
                className={inputCls} style={{ colorScheme: "dark" }} />
            </div>
            <div>
              <Label>หมายเหตุ</Label>
              <input type="text" value={stockInForm.note}
                onChange={(e) => setStockInForm({ ...stockInForm, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
            </div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-emerald-400 text-xs">ระบบจะสร้าง LOT + อัปเดต WAC ใน Stock_Levels อัตโนมัติ</p>
          </div>
          {modalMsg && <ModalMsg msg={modalMsg} />}
          <ModalActions onCancel={() => setStockInModal(null)} onConfirm={doStockIn}
            loading={modalLoading} confirmLabel="ยืนยันรับสินค้า" confirmClass="bg-gradient-to-r from-emerald-500 to-teal-400" />
        </Modal>
      )}

      {/* ═══ CANCEL MODAL ══════════════════════════════════════════════════ */}
      {cancelModal && (
        <Modal title="ยืนยันยกเลิก PO" onClose={() => !modalLoading && setCancelModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"   value={<span className="font-mono text-red-400">{cancelModal.po_id}</span>} />
            <Row label="สินค้า" value={cancelModal.product_name} />
          </div>
          <div className="mb-4">
            <Label>เหตุผลการยกเลิก</Label>
            <input type="text" value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="ระบุเหตุผล (ถ้ามี)" className={inputCls} />
          </div>
          {modalMsg && <ModalMsg msg={modalMsg} />}
          <ModalActions onCancel={() => setCancelModal(null)} onConfirm={doCancel}
            loading={modalLoading} confirmLabel="ยืนยันยกเลิก" confirmClass="bg-gradient-to-r from-red-500 to-rose-400" />
        </Modal>
      )}

      {/* ═══ DELETE MODAL ══════════════════════════════════════════════════ */}
      {deleteModal && (
        <Modal title="ยืนยันลบ PO" onClose={() => !modalLoading && setDeleteModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"   value={<span className="font-mono text-red-400">{deleteModal.po_id}</span>} />
            <Row label="สินค้า" value={deleteModal.product_name} />
            <Row label="สถานะ"  value={STATUS_CONFIG[deleteModal.status]?.label || deleteModal.status} />
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-amber-400 text-xs">การลบนี้ไม่สามารถกู้คืนได้</p>
          </div>
          {modalMsg && <ModalMsg msg={modalMsg} />}
          <ModalActions onCancel={() => setDeleteModal(null)} onConfirm={doDelete}
            loading={modalLoading} confirmLabel="ลบถาวร" confirmClass="bg-gradient-to-r from-red-500 to-rose-400" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-slate-300 text-right">{value}</span>
    </div>
  );
}

function ModalMsg({ msg }: { msg: string }) {
  const ok = !msg.startsWith("❌");
  return (
    <p className={`mb-3 text-sm px-4 py-2.5 rounded-xl border ${ok ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>{msg}</p>
  );
}

function ModalActions({ onCancel, onConfirm, loading, confirmLabel, confirmClass }: {
  onCancel: () => void; onConfirm: () => void;
  loading: boolean; confirmLabel: string; confirmClass: string;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel} disabled={loading}
        className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
        ยกเลิก
      </button>
      <button onClick={onConfirm} disabled={loading}
        className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all ${confirmClass}`}>
        {loading ? "กำลังดำเนินการ..." : confirmLabel}
      </button>
    </div>
  );
}
