"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface Product {
  product_id: number;
  product_name: string;
  category: string;
  brand: string;
  unit: string;
  unit_pkg: string;
  qty_per_pkg: number;
}

interface PODocData {
  po_id: string;
  created_at: string;
  product_name: string;
  brand: string;
  category: string;
  unit: string;
  unit_pkg: string;
  qty_ordered: number;
  qty_unit: number;
  cost_per_unit: number;
  cost_total: number;
  supplier_name: string;
  payment_method: string;
  payment_config_obj: any;
  expected_delivery: string;
  note: string;
  created_by: string;
  status?: string;
  signed_po_url?: string;
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
  signed_po_url: string;
}

type Tab          = "create" | "list";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED";

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/8 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all appearance-none";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">{children}</label>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: "รอดำเนินการ",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
  APPROVED:  { label: "อนุมัติแล้ว",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
  ORDERED:   { label: "รอรับของ",     color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20" },
  RECEIVED:  { label: "รับสินค้าแล้ว", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  CANCELLED: { label: "ยกเลิกแล้ว",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
};

const PAYMENT_LABELS: Record<string, string> = {
  FULL: "ชำระเต็มจำนวน", NET: "เครดิต (Net)", EQUAL: "ผ่อนเท่าๆ กัน",
  DEPOSIT: "มัดจำ", CUSTOM: "กำหนดเอง", INSTALLMENT: "ผ่อนชำระ", PARTIAL: "จ่ายบางส่วน",
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

  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab]               = useState<Tab>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [products, setProducts]     = useState<Product[]>([]);
  const [suppliers, setSuppliers]   = useState<string[]>([]);
  const [pos, setPos]               = useState<PO[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [globalMsg, setGlobalMsg]   = useState({ type: "", text: "" });

  // ── Modals ────────────────────────────────────────────────────────────────
  const [approveModal, setApproveModal] = useState<PO | null>(null);
  const [confirmModal, setConfirmModal] = useState<PO | null>(null);
  const [stockInModal, setStockInModal] = useState<PO | null>(null);
  const [cancelModal, setCancelModal]   = useState<PO | null>(null);
  const [deleteModal, setDeleteModal]   = useState<PO | null>(null);
  const [showPreview, setShowPreview]   = useState(false);
  const [poDocModal, setPoDocModal]     = useState<PODocData | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg]         = useState("");

  const [stockInForm, setStockInForm] = useState({ expiry_date: "", note: "" });
  const [cancelNote, setCancelNote]   = useState("");

  // ── Confirm form (payment method + delivery) ─────────────────────────────
  const [confirmForm, setConfirmForm] = useState({
    payment_method: "FULL", net_days: "30", installments_count: "3",
    interval_months: "1", deposit_pct: "30", expected_delivery: "", signed_po_url: "",
  });
  const [confirmCustomRows, setConfirmCustomRows] = useState<{ due_date: string; amount: string }[]>([{ due_date: "", amount: "" }]);
  const [signedPoFile, setSignedPoFile]   = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Create form (simplified) ─────────────────────────────────────────────
  const [form, setForm] = useState({
    product_id: "", qty_ordered: "", cost_total: "",
    supplier_name: "", note: "",
  });

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

  // Confirm form computed
  const cTotal = confirmModal ? Number(confirmModal.cost_total) : 0;
  const cEqualAmt   = confirmForm.payment_method === "EQUAL" && Number(confirmForm.installments_count) > 0
    ? Math.round(cTotal / Number(confirmForm.installments_count)) : 0;
  const cDepositAmt = Math.round(cTotal * (Number(confirmForm.deposit_pct) || 0) / 100);
  const cRemainAmt  = cTotal - cDepositAmt;
  const cCustomTotal = confirmCustomRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cCustomDiff  = cTotal - cCustomTotal;

  function resetForm() {
    setForm({ product_id: "", qty_ordered: "", cost_total: "", supplier_name: "", note: "" });
  }

  async function reloadPos() {
    const r = await fetch("/api/inv/po");
    setPos((await r.json()).pos || []);
  }

  async function doCreate() {
    if (!selectedProduct) return;
    setSubmitting(true);
    setShowPreview(false);
    setGlobalMsg({ type: "", text: "" });
    try {
      const res = await fetch("/api/inv/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id:   selectedProduct.product_id,
          product_name: selectedProduct.product_name,
          category:     selectedProduct.category,
          brand:        selectedProduct.brand,
          unit:         selectedProduct.unit,
          unit_pkg:     selectedProduct.unit_pkg,
          qty_per_pkg:  selectedProduct.qty_per_pkg,
          qty_ordered:  Number(form.qty_ordered),
          cost_total:   Number(form.cost_total),
          supplier_name: form.supplier_name,
          note:         form.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGlobalMsg({ type: "success", text: `สร้าง PO สำเร็จ: ${data.po_id} — รอหัวหน้าอนุมัติ` });
      resetForm();
      await reloadPos();
      setTab("list");
      setStatusFilter("PENDING");
    } catch (e: any) {
      setGlobalMsg({ type: "error", text: e.message });
    } finally { setSubmitting(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await doCreate();
  }

  function buildPreviewData(): PODocData {
    return {
      po_id: "(ร่าง)",
      created_at: new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }),
      product_name: selectedProduct?.product_name || "",
      brand:        selectedProduct?.brand || "",
      category:     selectedProduct?.category || "",
      unit:         selectedProduct?.unit || "",
      unit_pkg:     selectedProduct?.unit_pkg || "",
      qty_ordered:  Number(form.qty_ordered) || 0,
      qty_unit:     calcQtyUnit,
      cost_per_unit: costTotalNum && calcQtyUnit ? costTotalNum / calcQtyUnit : 0,
      cost_total:   costTotalNum,
      supplier_name: form.supplier_name,
      payment_method: "—",
      payment_config_obj: {},
      expected_delivery: "",
      note:         form.note,
      created_by:   "",
    };
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
      setModalMsg("อนุมัติสำเร็จ — กรอกวิธีชำระและวันรับของต่อไป");
      await reloadPos();
      setTimeout(() => { setApproveModal(null); setStatusFilter("APPROVED"); }, 1500);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); }
    finally { setModalLoading(false); }
  }

  async function doConfirm() {
    if (!confirmModal) return;
    if (confirmForm.payment_method === "CUSTOM") {
      if (confirmCustomRows.some((r) => !r.due_date || !r.amount))
        return setModalMsg("❌ กรุณากรอกวันและจำนวนเงินทุกงวด");
      if (Math.abs(cCustomDiff) >= 1)
        return setModalMsg(`❌ ยอดรวมงวดต่างจากราคา ${Math.abs(cCustomDiff).toLocaleString()} บาท`);
    }
    setModalLoading(true); setModalMsg("");
    try {
      // ── อัปโหลดไฟล์ก่อน (ถ้ามี) ─────────────────────────────────────────
      let signedUrl = confirmForm.signed_po_url;
      if (signedPoFile) {
        setUploadingFile(true);
        setModalMsg("⏳ กำลังอัปโหลดไฟล์...");
        const fd = new FormData();
        fd.append("file", signedPoFile);
        fd.append("po_id", confirmModal.po_id);
        const upRes  = await fetch("/api/inv/po/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        setUploadingFile(false);
        if (!upRes.ok) throw new Error(upData.error || "Upload ไม่สำเร็จ");
        signedUrl = upData.fileUrl;
        setModalMsg("✓ อัปโหลดสำเร็จ กำลังบันทึก...");
      }

      const res = await fetch("/api/inv/po", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_id:               confirmModal.po_id,
          action:              "confirm",
          payment_method:      confirmForm.payment_method,
          net_days:            Number(confirmForm.net_days),
          installments_count:  Number(confirmForm.installments_count),
          interval_months:     Number(confirmForm.interval_months),
          deposit_pct:         Number(confirmForm.deposit_pct),
          custom_installments: confirmForm.payment_method === "CUSTOM"
            ? confirmCustomRows.map((r) => ({ due_date: r.due_date, amount: Number(r.amount) })) : [],
          expected_delivery:   confirmForm.expected_delivery,
          signed_po_url:       signedUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const lc = data.liabilities_created ?? 0;
      setModalMsg(lc > 0 ? `✓ ยืนยันสำเร็จ · สร้างตารางชำระ ${lc} งวด` : "✓ ยืนยันสำเร็จ");
      await reloadPos();
      setTimeout(() => { setConfirmModal(null); setSignedPoFile(null); setStatusFilter("ORDERED"); }, 1500);
    } catch (e: any) { setModalMsg(`❌ ${e.message}`); setUploadingFile(false); }
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
      setModalMsg(`✓ รับสินค้าสำเร็จ · Lot: ${data.lot_id}`);
      await reloadPos();
      setTimeout(() => { setStockInModal(null); setStockInForm({ expiry_date: "", note: "" }); setStatusFilter("RECEIVED"); }, 1200);
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
      await reloadPos();
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
    ORDERED:   pos.filter((p) => p.status === "ORDERED").length,
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
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
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

        {/* ═══ CREATE TAB ═══════════════════════════════════════════════════════ */}
        {tab === "create" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] p-6 relative overflow-hidden">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

            {/* Flow steps */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              {[
                { n: 1, label: "กรอกรายการ", active: true,  done: false },
                { n: 2, label: "รออนุมัติ",  active: false, done: false },
                { n: 3, label: "ยืนยันการชำระ", active: false, done: false },
                { n: 4, label: "รับของ",     active: false, done: false },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                    s.active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-slate-600"
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.active ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-600"}`}>{s.n}</span>
                    {s.label}
                  </div>
                  {i < 3 && <svg className="w-3 h-3 text-slate-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
                </div>
              ))}
            </div>

            <h2 className="text-white font-semibold mb-1">สร้าง Purchase Order</h2>
            <p className="text-slate-500 text-xs mb-5">กรอกเฉพาะสินค้า จำนวน และราคา — วิธีชำระจะกรอกหลังหัวหน้าอนุมัติ</p>

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
                  {calcQtyUnit > 0 && costTotalNum > 0 && (
                    <p className="text-xs text-emerald-400 mt-1.5">≈ {(costTotalNum / calcQtyUnit).toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท/{selectedProduct?.unit}</p>
                  )}
                </div>

                <div>
                  <Label>ผู้จัดจำหน่าย</Label>
                  <select value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} className={selectCls}>
                    <option value="">— เลือก Supplier (ถ้ามี) —</option>
                    {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <input type="text" value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="button"
                  disabled={!selectedProduct || !form.qty_ordered || !form.cost_total}
                  onClick={() => setShowPreview(true)}
                  className="px-5 py-2.5 bg-white/5 border border-white/15 text-slate-400 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  Preview
                </button>
                <button type="submit" disabled={submitting}
                  className="px-7 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all shadow-lg"
                  style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
                  {submitting ? "กำลังสร้าง..." : "ส่ง PO ให้หัวหน้าอนุมัติ"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ═══ LIST TAB ════════════════════════════════════════════════════════= */}
        {tab === "list" && (
          <>
            {/* Flow legend */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 overflow-x-auto pb-1">
              {["PENDING → รออนุมัติ","APPROVED → ยืนยันการชำระ","ORDERED → รอรับของ","RECEIVED → เสร็จสิ้น"].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                  <span>{s}</span>
                  {i < 3 && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["ALL","PENDING","APPROVED","ORDERED","RECEIVED","CANCELLED"] as StatusFilter[]).map((s) => {
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
                    const isInstallment = po.payment_method && po.payment_method !== "FULL";
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
                              {po.signed_po_url && (
                                <a href={po.signed_po_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 transition-all flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                                  ใบ PO เซ็นแล้ว
                                </a>
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
                            {/* Document button */}
                            <button onClick={() => setPoDocModal({
                              po_id: po.po_id, created_at: po.created_at,
                              product_name: po.product_name, brand: po.brand, category: po.category,
                              unit: po.unit, unit_pkg: po.unit_pkg,
                              qty_ordered: Number(po.qty_ordered), qty_unit: Number(po.qty_unit),
                              cost_per_unit: Number(po.cost_per_unit), cost_total: Number(po.cost_total),
                              supplier_name: po.supplier_name, payment_method: po.payment_method || "—",
                              payment_config_obj: cfg2, expected_delivery: po.expected_delivery,
                              note: po.note, created_by: po.created_by,
                              status: po.status, signed_po_url: po.signed_po_url,
                            })}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-indigo-500/15 hover:border-indigo-500/20 hover:text-indigo-400 text-xs font-medium transition-all flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                              เอกสาร
                            </button>

                            {/* PENDING: อนุมัติ */}
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

                            {/* APPROVED: ยืนยันการชำระ + upload */}
                            {po.status === "APPROVED" && (
                              <>
                                <button onClick={() => {
                                  setConfirmModal(po);
                                  setModalMsg("");
                                  setSignedPoFile(null);
                                  setConfirmForm({ payment_method: "FULL", net_days: "30", installments_count: "3", interval_months: "1", deposit_pct: "30", expected_delivery: po.expected_delivery || "", signed_po_url: po.signed_po_url || "" });
                                  setConfirmCustomRows([{ due_date: "", amount: "" }]);
                                }}
                                  className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 text-xs font-medium transition-all flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                  ยืนยันการสั่งซื้อ
                                </button>
                                <button onClick={() => { setCancelModal(po); setModalMsg(""); setCancelNote(""); }}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs font-medium transition-all">ยกเลิก</button>
                              </>
                            )}

                            {/* ORDERED: รับของ */}
                            {po.status === "ORDERED" && (
                              <>
                                <button onClick={() => { setStockInModal(po); setModalMsg(""); setStockInForm({ expiry_date: "", note: "" }); }}
                                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1"
                                  style={{ boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                                  รับของ
                                </button>
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

      {/* ═══ PREVIEW (Create form) ═══════════════════════════════════════════ */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className="w-full max-w-2xl my-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-white font-semibold text-sm">Preview ใบสั่งซื้อ</p>
              <div className="flex items-center gap-2">
                <button onClick={() => doCreate()}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2"
                  style={{ boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  ส่งให้หัวหน้าอนุมัติ
                </button>
                <button onClick={() => setShowPreview(false)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <PODocumentView data={buildPreviewData()} />
          </div>
        </div>
      )}

      {/* ═══ DOCUMENT VIEW (from list) ════════════════════════════════════════ */}
      {poDocModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setPoDocModal(null); }}>
          <div className="w-full max-w-2xl my-4">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-white font-semibold text-sm">ใบสั่งซื้อ — {poDocModal.po_id}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-slate-300 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                  พิมพ์
                </button>
                <button onClick={() => setPoDocModal(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <PODocumentView data={poDocModal} />
          </div>
        </div>
      )}

      {/* ═══ APPROVE MODAL ═══════════════════════════════════════════════════ */}
      {approveModal && (
        <Modal title="ยืนยันอนุมัติ PO" onClose={() => !modalLoading && setApproveModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"   value={<span className="font-mono text-blue-400">{approveModal.po_id}</span>} />
            <Row label="สินค้า" value={<span className="text-white font-semibold">{approveModal.product_name}</span>} />
            <Row label="จำนวน"  value={`${approveModal.qty_unit} ${approveModal.unit}`} />
            <Row label="ราคารวม" value={`${Number(approveModal.cost_total).toLocaleString()} บาท`} />
            {approveModal.supplier_name && <Row label="Supplier" value={approveModal.supplier_name} />}
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4">
            <p className="text-blue-400 text-xs">หลังอนุมัติ → ต้องกรอกวิธีชำระเงินและวันรับของก่อนรับสินค้าได้</p>
          </div>
          {modalMsg && <ModalMsg msg={modalMsg} />}
          <ModalActions onCancel={() => setApproveModal(null)} onConfirm={doApprove}
            loading={modalLoading} confirmLabel="✓ อนุมัติ" confirmClass="bg-gradient-to-r from-blue-500 to-indigo-400" />
        </Modal>
      )}

      {/* ═══ CONFIRM MODAL (วิธีชำระ + วันรับของ) ════════════════════════════ */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !modalLoading) setConfirmModal(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-2xl relative overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-white font-bold">ยืนยันการสั่งซื้อ</h3>
                  <p className="text-slate-500 text-xs mt-0.5">กรอกวิธีชำระและวันรับของ — ระบบสร้าง Liabilities ให้อัตโนมัติ</p>
                </div>
                <button onClick={() => setConfirmModal(null)} disabled={modalLoading}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {/* PO summary */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 my-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="text-slate-500">PO: <span className="text-blue-400 font-mono">{confirmModal.po_id}</span></span>
                <span className="text-slate-500">สินค้า: <span className="text-white font-semibold">{confirmModal.product_name}</span></span>
                <span className="text-slate-500">จำนวน: <span className="text-white">{confirmModal.qty_unit} {confirmModal.unit}</span></span>
                <span className="text-slate-500">ราคา: <span className="text-white font-bold">{Number(confirmModal.cost_total).toLocaleString()} บาท</span></span>
              </div>

              <div className="space-y-5">
                {/* Payment method */}
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">รูปแบบการชำระเงิน</label>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button type="button" key={m.value}
                        onClick={() => setConfirmForm({ ...confirmForm, payment_method: m.value })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          confirmForm.payment_method === m.value
                            ? "bg-emerald-500/15 border-emerald-500/40"
                            : "bg-white/[0.03] border-white/10 hover:border-white/20"
                        }`}>
                        <p className={`text-xs font-semibold ${confirmForm.payment_method === m.value ? "text-emerald-400" : "text-slate-300"}`}>{m.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Payment config panel */}
                  {confirmForm.payment_method === "NET" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-36">
                          <label className="text-xs text-slate-400 mb-1.5 block">ชำระภายใน (วัน)</label>
                          <input type="number" min="1" value={confirmForm.net_days}
                            onChange={(e) => setConfirmForm({ ...confirmForm, net_days: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div className="flex gap-2 mt-5">
                          {["30","45","60","90"].map((d) => (
                            <button type="button" key={d}
                              onClick={() => setConfirmForm({ ...confirmForm, net_days: d })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                confirmForm.net_days === d
                                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                              }`}>Net{d}</button>
                          ))}
                        </div>
                      </div>
                      {cTotal > 0 && confirmForm.net_days && (
                        <p className="text-xs text-emerald-400">ครบกำหนดชำระ {cTotal.toLocaleString()} บาท ใน Net {confirmForm.net_days} วัน</p>
                      )}
                    </div>
                  )}

                  {confirmForm.payment_method === "EQUAL" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">จำนวนงวด</label>
                          <input type="number" min="1" max="60" value={confirmForm.installments_count}
                            onChange={(e) => setConfirmForm({ ...confirmForm, installments_count: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">ทุกกี่เดือน</label>
                          <input type="number" min="1" max="12" value={confirmForm.interval_months}
                            onChange={(e) => setConfirmForm({ ...confirmForm, interval_months: e.target.value })}
                            className={inputCls} />
                        </div>
                      </div>
                      {cEqualAmt > 0 && (
                        <p className="text-xs text-emerald-400">งวดละ ≈ {cEqualAmt.toLocaleString()} บาท × {confirmForm.installments_count} งวด{Number(confirmForm.interval_months) > 1 ? ` (ทุก ${confirmForm.interval_months} เดือน)` : ""}</p>
                      )}
                    </div>
                  )}

                  {confirmForm.payment_method === "DEPOSIT" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">มัดจำ (%)</label>
                          <input type="number" min="1" max="99" value={confirmForm.deposit_pct}
                            onChange={(e) => setConfirmForm({ ...confirmForm, deposit_pct: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block">ส่วนที่เหลือใน (เดือน)</label>
                          <input type="number" min="1" value={confirmForm.interval_months}
                            onChange={(e) => setConfirmForm({ ...confirmForm, interval_months: e.target.value })}
                            className={inputCls} />
                        </div>
                      </div>
                      {cTotal > 0 && (
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 px-3 py-1.5 rounded-lg">มัดจำ {confirmForm.deposit_pct}% = {cDepositAmt.toLocaleString()} บาท</span>
                          <span className="text-slate-500">+</span>
                          <span className="bg-white/5 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg">ส่วนที่เหลือ {cRemainAmt.toLocaleString()} บาท ใน {confirmForm.interval_months} เดือน</span>
                        </div>
                      )}
                    </div>
                  )}

                  {confirmForm.payment_method === "CUSTOM" && (
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                      <div className="space-y-2">
                        {confirmCustomRows.map((row, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-10 flex-shrink-0">งวด {i + 1}</span>
                            <input type="date" value={row.due_date}
                              onChange={(e) => setConfirmCustomRows((prev) => prev.map((r, j) => j === i ? { ...r, due_date: e.target.value } : r))}
                              className={`${inputCls} flex-1`} style={{ colorScheme: "dark" }} />
                            <input type="number" min="0" placeholder="จำนวนเงิน (บาท)" value={row.amount}
                              onChange={(e) => setConfirmCustomRows((prev) => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                              className={`${inputCls} w-40`} />
                            {confirmCustomRows.length > 1 && (
                              <button type="button"
                                onClick={() => setConfirmCustomRows((prev) => prev.filter((_, j) => j !== i))}
                                className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button"
                        onClick={() => setConfirmCustomRows((prev) => [...prev, { due_date: "", amount: "" }])}
                        className="text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-all">
                        + เพิ่มงวด
                      </button>
                      {cTotal > 0 && (
                        <div className={`text-xs px-3 py-2 rounded-lg border flex gap-2 ${Math.abs(cCustomDiff) < 1 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                          <span>ยอดรวม {cCustomTotal.toLocaleString()} / {cTotal.toLocaleString()} บาท</span>
                          {Math.abs(cCustomDiff) >= 1 && <span>· {cCustomDiff > 0 ? `ยังขาด ${cCustomDiff.toLocaleString()}` : `เกิน ${Math.abs(cCustomDiff).toLocaleString()}`} บาท</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expected delivery */}
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">กำหนดส่งสินค้า</label>
                  <input type="date" value={confirmForm.expected_delivery}
                    onChange={(e) => setConfirmForm({ ...confirmForm, expected_delivery: e.target.value })}
                    className={inputCls} style={{ colorScheme: "dark" }} />
                </div>

                {/* Signed PO Upload */}
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
                    ใบ PO ที่หัวหน้าเซ็นแล้ว
                    <span className="text-slate-600 font-normal ml-1 normal-case">(ไม่บังคับ — PDF หรือรูปภาพ)</span>
                  </label>

                  {/* Drop zone / file input */}
                  {!signedPoFile && !confirmForm.signed_po_url ? (
                    <label className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-white/15 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer">
                      <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      <span className="text-xs text-slate-500">คลิกเพื่อเลือกไฟล์ PDF หรือรูปภาพ</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setSignedPoFile(f);
                        }} />
                    </label>
                  ) : signedPoFile ? (
                    /* ไฟล์ถูกเลือกแล้ว */
                    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                      <svg className="w-8 h-8 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{signedPoFile.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(signedPoFile.size / 1024).toFixed(0)} KB · {signedPoFile.type.includes("pdf") ? "PDF" : "รูปภาพ"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setSignedPoFile(null)}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-slate-400 transition-all flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    /* มี URL อยู่แล้ว (จาก PO ก่อนหน้า) */
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 mb-0.5">ไฟล์ที่อัปโหลดไว้แล้ว</p>
                        <a href={confirmForm.signed_po_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-400 underline truncate block">{confirmForm.signed_po_url}</a>
                      </div>
                      <label className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400 hover:text-white cursor-pointer transition-all flex-shrink-0">
                        เปลี่ยน
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) { setSignedPoFile(f); setConfirmForm((cf) => ({ ...cf, signed_po_url: "" })); }
                          }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {modalMsg && <ModalMsg msg={modalMsg} />}

              <div className="flex gap-3 mt-5">
                <button onClick={() => setConfirmModal(null)} disabled={modalLoading}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                  ยกเลิก
                </button>
                <button onClick={doConfirm} disabled={modalLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                  {modalLoading ? "กำลังดำเนินการ..." : "✓ ยืนยันการสั่งซื้อ → รอรับของ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STOCK-IN MODAL ══════════════════════════════════════════════════ */}
      {stockInModal && (
        <Modal title="รับสินค้าเข้าคลัง" onClose={() => !modalLoading && setStockInModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"           value={<span className="font-mono text-emerald-400">{stockInModal.po_id}</span>} />
            <Row label="สินค้า"         value={<span className="text-white font-semibold">{stockInModal.product_name}</span>} />
            <Row label="จำนวน"          value={`${stockInModal.qty_unit} ${stockInModal.unit}`} />
            {stockInModal.expected_delivery && <Row label="กำหนดส่ง" value={stockInModal.expected_delivery} />}
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <Label>วันหมดอายุสินค้า *</Label>
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
            loading={modalLoading} confirmLabel="✓ ยืนยันรับสินค้า" confirmClass="bg-gradient-to-r from-emerald-500 to-teal-400" />
        </Modal>
      )}

      {/* ═══ CANCEL MODAL ════════════════════════════════════════════════════ */}
      {cancelModal && (
        <Modal title="ยืนยันยกเลิก PO" onClose={() => !modalLoading && setCancelModal(null)}>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
            <Row label="PO ID"   value={<span className="font-mono text-red-400">{cancelModal.po_id}</span>} />
            <Row label="สินค้า" value={cancelModal.product_name} />
            <Row label="สถานะ"  value={STATUS_CONFIG[cancelModal.status]?.label || cancelModal.status} />
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

      {/* ═══ DELETE MODAL ════════════════════════════════════════════════════ */}
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
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

// ─── PO Document ─────────────────────────────────────────────────────────────

function POPaymentTerms({ data }: { data: PODocData }) {
  const { payment_method: m, payment_config_obj: cfg, cost_total } = data;
  if (!m || m === "—") return <p className="text-gray-500 italic text-sm">ยังไม่ได้กำหนด (กรอกหลังอนุมัติ)</p>;
  if (m === "FULL") return <p className="text-gray-700">ชำระเต็มจำนวน <span className="font-semibold">{cost_total.toLocaleString("th-TH")} บาท</span> เมื่ออนุมัติ PO</p>;
  if (m === "NET") {
    const nd = cfg?.net_days ?? 30;
    return <p className="text-gray-700">เครดิต <span className="font-semibold">Net {nd} วัน</span> — ชำระ {cost_total.toLocaleString("th-TH")} บาท ภายใน {nd} วันหลังรับสินค้า</p>;
  }
  if (m === "EQUAL" || m === "INSTALLMENT") {
    const count = cfg?.installments ?? 1;
    const im    = cfg?.interval_months ?? 1;
    const base  = count > 0 ? Math.round((cost_total / count) * 100) / 100 : 0;
    return (
      <div>
        <p className="text-gray-700 mb-2">ผ่อน <span className="font-semibold">{count} งวดเท่ากัน</span> · งวดละ ≈ {base.toLocaleString("th-TH")} บาท · ทุก {im} เดือน</p>
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-gray-100"><th className="border border-gray-200 px-2 py-1.5 text-left">งวด</th><th className="border border-gray-200 px-2 py-1.5 text-right">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>
            {Array.from({ length: count }, (_, i) => {
              const amt = i === count - 1 ? Math.round((cost_total - base * (count - 1)) * 100) / 100 : base;
              return <tr key={i} className={i % 2 ? "bg-gray-50" : ""}><td className="border border-gray-200 px-2 py-1.5">งวด {i + 1}</td><td className="border border-gray-200 px-2 py-1.5 text-right">{amt.toLocaleString("th-TH")}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    );
  }
  if (m === "DEPOSIT") {
    const pct = cfg?.deposit_pct ?? 30; const im = cfg?.interval_months ?? 1;
    const dAmt = Math.round(cost_total * pct / 100); const remain = cost_total - dAmt;
    return (
      <div>
        <p className="text-gray-700 mb-2">มัดจำ {pct}% จ่ายทันที + ส่วนที่เหลือใน {im} เดือน</p>
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-gray-100"><th className="border border-gray-200 px-2 py-1.5 text-left">งวด</th><th className="border border-gray-200 px-2 py-1.5 text-left">กำหนดชำระ</th><th className="border border-gray-200 px-2 py-1.5 text-right">จำนวนเงิน (บาท)</th></tr></thead>
          <tbody>
            <tr><td className="border border-gray-200 px-2 py-1.5">มัดจำ {pct}%</td><td className="border border-gray-200 px-2 py-1.5">เมื่ออนุมัติ</td><td className="border border-gray-200 px-2 py-1.5 text-right font-medium">{dAmt.toLocaleString("th-TH")}</td></tr>
            <tr className="bg-gray-50"><td className="border border-gray-200 px-2 py-1.5">ส่วนที่เหลือ</td><td className="border border-gray-200 px-2 py-1.5">ใน {im} เดือน</td><td className="border border-gray-200 px-2 py-1.5 text-right font-medium">{remain.toLocaleString("th-TH")}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (m === "CUSTOM" || m === "PARTIAL") {
    const inst: any[] = Array.isArray(cfg?.installments) ? cfg.installments : [];
    return (
      <div>
        <p className="text-gray-700 mb-2">กำหนดการชำระเอง <span className="font-semibold">{inst.length} งวด</span></p>
        {inst.length > 0 && (
          <table className="w-full border-collapse text-xs">
            <thead><tr className="bg-gray-100"><th className="border border-gray-200 px-2 py-1.5 text-left">งวด</th><th className="border border-gray-200 px-2 py-1.5 text-left">ครบกำหนด</th><th className="border border-gray-200 px-2 py-1.5 text-right">จำนวนเงิน (บาท)</th></tr></thead>
            <tbody>{inst.map((item: any, i: number) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}><td className="border border-gray-200 px-2 py-1.5">งวด {i + 1}</td><td className="border border-gray-200 px-2 py-1.5">{item.due_date || "—"}</td><td className="border border-gray-200 px-2 py-1.5 text-right">{Number(item.amount || 0).toLocaleString("th-TH")}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    );
  }
  return <p className="text-gray-600">{m}</p>;
}

const STATUS_TH: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "รอดำเนินการ",  cls: "bg-amber-100 text-amber-700 border border-amber-300" },
  APPROVED:  { label: "อนุมัติแล้ว",  cls: "bg-blue-100 text-blue-700 border border-blue-300" },
  ORDERED:   { label: "รอรับของ",     cls: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
  RECEIVED:  { label: "รับสินค้าแล้ว", cls: "bg-emerald-100 text-emerald-700 border border-emerald-300" },
  CANCELLED: { label: "ยกเลิกแล้ว",   cls: "bg-red-100 text-red-700 border border-red-300" },
};

function PODocumentView({ data }: { data: PODocData }) {
  const todayTH = new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const displayDate = data.created_at || todayTH;
  const statusInfo  = data.status ? STATUS_TH[data.status] : null;
  const isDraft     = data.po_id === "(ร่าง)";

  return (
    <div className="bg-white text-gray-800 rounded-2xl shadow-2xl overflow-hidden">
      {isDraft && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <p className="text-amber-700 text-xs font-medium">ร่างเอกสาร — ยังไม่บันทึก กด "ส่งให้หัวหน้าอนุมัติ" เพื่อยืนยัน</p>
        </div>
      )}
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-7 pb-5 border-b-2 border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ใบสั่งซื้อ</h1>
            <p className="text-gray-400 text-sm tracking-widest uppercase mt-0.5">Purchase Order</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-2">
              <p className="text-gray-500 text-sm">เลขที่:</p>
              <p className={`font-bold text-base ${isDraft ? "text-amber-600" : "text-gray-900"}`}>{data.po_id}</p>
            </div>
            <p className="text-gray-500 text-sm">วันที่: <span className="text-gray-700 font-medium">{displayDate}</span></p>
            {statusInfo && <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>}
          </div>
        </div>

        {/* Supplier / Buyer */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">ผู้ขาย (Supplier)</p>
            <p className="font-semibold text-gray-900 text-base">{data.supplier_name || <span className="text-gray-400 font-normal italic">ยังไม่ระบุ</span>}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">ผู้สั่งซื้อ</p>
            <p className="font-semibold text-gray-900 text-base">{data.created_by || <span className="text-gray-400 font-normal">—</span>}</p>
            {data.expected_delivery && <p className="text-gray-500 text-xs mt-1.5">📅 กำหนดส่ง: <span className="font-medium text-gray-700">{data.expected_delivery}</span></p>}
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2.5 text-left text-xs font-semibold rounded-tl-lg">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">รายการสินค้า</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold">จำนวน</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">หน่วย</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold">ราคา/หน่วย</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold rounded-tr-lg">รวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="px-3 py-3 text-center text-gray-500">1</td>
              <td className="px-3 py-3">
                <p className="font-semibold text-gray-900">{data.product_name || "—"}</p>
                {data.brand    && <p className="text-gray-400 text-xs mt-0.5">{data.brand}</p>}
                {data.category && <p className="text-gray-400 text-xs">{data.category}</p>}
              </td>
              <td className="px-3 py-3 text-right font-medium">{(data.qty_unit || 0).toLocaleString("th-TH")}</td>
              <td className="px-3 py-3 text-gray-600">{data.unit || "—"}</td>
              <td className="px-3 py-3 text-right text-gray-600">{data.cost_per_unit > 0 ? data.cost_per_unit.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>
              <td className="px-3 py-3 text-right font-bold">{(data.cost_total || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-gray-800 text-white">
              <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold rounded-bl-lg">ยอดรวมทั้งสิ้น</td>
              <td className="px-3 py-3 text-right text-base font-bold rounded-br-lg">{(data.cost_total || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</td>
            </tr>
          </tfoot>
        </table>

        {/* Payment */}
        <div className="mb-5 border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">เงื่อนไขการชำระเงิน</p>
          <POPaymentTerms data={data} />
        </div>

        {/* Signed PO link */}
        {data.signed_po_url && (
          <div className="mb-5 border border-emerald-200 rounded-xl p-4 bg-emerald-50 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">ใบ PO ที่หัวหน้าเซ็นแล้ว</p>
              <a href={data.signed_po_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-700 underline truncate block">{data.signed_po_url}</a>
            </div>
          </div>
        )}

        {/* Note */}
        {data.note && (
          <div className="mb-5 border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5">หมายเหตุ</p>
            <p className="text-gray-700 text-sm">{data.note}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-8 pt-6 border-t-2 border-gray-200">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-10">ผู้สั่งซื้อ / Ordered by</p>
            <div className="border-b border-gray-400" />
            <p className="text-xs text-gray-400 mt-2">ลายเซ็น / วันที่</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-10">ผู้อนุมัติ / Approved by</p>
            <div className="border-b border-gray-400" />
            <p className="text-xs text-gray-400 mt-2">ลายเซ็น / วันที่</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

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
