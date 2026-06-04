"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

// ── Types ───────────────────────────────────────────────────────────────────
interface Debt {
  debt_id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  debt_type: "installment" | "credit";
  total_amount: number;
  paid_amount: number;
  remaining: number;
  installment_count: number;
  first_due_date: string;
  source_ref: string;
  branch_id: string;
  branch_name: string;
  status: "active" | "overdue" | "settled";
  note: string;
  created_by: string;
  next_due_date: string | null;
  next_due_amount: number | null;
  next_inst_id: string | null;
  pending_count: number;
}

interface Installment {
  inst_id: string;
  debt_id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_date: string;
  status: "pending" | "paid" | "partial" | "overdue";
  note: string;
}

type StatusFilter = "all" | "active" | "overdue" | "settled";

interface SalesRow {
  row_idx: number;
  date: string;
  customer_name: string;
  customer_phone: string;
  program: string;
  amount: number;
  paid: number;
  outstanding: number;
  branch: string;
  branch_id: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all";

const PAYMENT_METHODS = ["เงินสด", "โอนเงิน", "บัตรเครดิต", "QR Code", "อื่นๆ"];

function statusBadge(s: string) {
  if (s === "active")   return "bg-blue-500/15 text-blue-400 border-blue-500/20";
  if (s === "overdue")  return "bg-red-500/15 text-red-400 border-red-500/20";
  if (s === "settled")  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (s === "paid")     return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (s === "partial")  return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (s === "pending")  return "bg-slate-500/15 text-slate-400 border-slate-500/20";
  return "bg-white/5 text-slate-400 border-white/10";
}

function statusLabel(s: string) {
  if (s === "active")   return "ค้างอยู่";
  if (s === "overdue")  return "⚠ เกินกำหนด";
  if (s === "settled")  return "✓ ชำระครบ";
  if (s === "paid")     return "✓ ชำระแล้ว";
  if (s === "partial")  return "ชำระบางส่วน";
  if (s === "pending")  return "รอชำระ";
  return s;
}

function debtTypeLabel(t: string) {
  return t === "installment" ? "ผ่อนงวด" : "ค้างจ่าย";
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due   = new Date(dateStr + "T00:00:00");
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ARPage() {
  const router = useRouter();

  const [navOpen, setNavOpen]       = useState(false);
  const [debts, setDebts]           = useState<Debt[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [role, setRole]             = useState("");
  const [myBranchId, setMyBranchId] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");

  // ── Filters ─────────────────────────────────────────────────────────────
  const [searchQ, setSearchQ]         = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [branchFilter, setBranchFilter] = useState("");

  // ── Create modal ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    customer_name: "", customer_phone: "",
    debt_type: "credit" as "installment" | "credit",
    total_amount: "", down_payment: "",
    installment_count: "1",
    first_due_date: "",
    source_ref: "", note: "",
    branch_id: "", branch_name: "",  // จาก Sales row หรือ default ของ user
  });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // ── Sales Picker (inside create modal) ──────────────────────────────────
  const [salesPickerOpen, setSalesPickerOpen]   = useState(false);
  const [salesFrom, setSalesFrom]               = useState("");
  const [salesTo, setSalesTo]                   = useState("");
  const [salesSearch, setSalesSearch]           = useState("");
  const [salesRows, setSalesRows]               = useState<SalesRow[]>([]);
  const [salesLoading, setSalesLoading]         = useState(false);
  const [salesFetched, setSalesFetched]         = useState(false);
  const [salesError, setSalesError]             = useState("");
  const [salesNoDB, setSalesNoDB]               = useState(false);
  const [salesNoSheet, setSalesNoSheet]         = useState(false);
  const [salesManualId, setSalesManualId]       = useState("");
  const [salesIncludeAll, setSalesIncludeAll]   = useState(false);
  const [selectedSalesRow, setSelectedSalesRow] = useState<SalesRow | null>(null);

  // ── Pay modal ────────────────────────────────────────────────────────────
  const [payDebt, setPayDebt]           = useState<Debt | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loadingInst, setLoadingInst]   = useState(false);
  const [selInst, setSelInst]           = useState<Installment | null>(null);
  const [payForm, setPayForm]           = useState({ amount: "", payment_method: "เงินสด", note: "" });
  const [paying, setPaying]             = useState(false);
  const [payMsg, setPayMsg]             = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [authRes, debtsRes] = await Promise.all([
        fetch("/api/auth/branch-check").then((r) => r.json()),
        fetch("/api/ar/debts").then((r) => r.json()),
      ]);
      setRole(authRes.role || "");
      setMyBranchId(authRes.branchId || "");
      if (debtsRes.error) throw new Error(debtsRes.error);
      setDebts(debtsRes.debts || []);
      if (debtsRes.spreadsheetId) setSpreadsheetId(debtsRes.spreadsheetId);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Open pay modal ────────────────────────────────────────────────────────
  async function openPay(d: Debt) {
    setPayDebt(d);
    setPayMsg("");
    setSelInst(null);
    setPayForm({ amount: "", payment_method: "เงินสด", note: "" });
    setLoadingInst(true);
    setInstallments([]);
    try {
      const res  = await fetch(`/api/ar/installments?debt_id=${encodeURIComponent(d.debt_id)}`);
      const data = await res.json();
      setInstallments(data.installments || []);
      // auto-select งวดแรกที่ยังไม่ชำระ
      const first = (data.installments || []).find(
        (i: Installment) => i.status === "pending" || i.status === "overdue" || i.status === "partial"
      );
      if (first) {
        setSelInst(first);
        setPayForm((f) => ({ ...f, amount: String(first.amount - first.paid_amount) }));
      }
    } catch (e: any) { setPayMsg(`❌ ${e.message}`); }
    finally { setLoadingInst(false); }
  }

  // ── Handle create ─────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createForm.customer_name || !createForm.total_amount || !createForm.first_due_date) {
      setCreateMsg("⚠ กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
      return;
    }
    setCreating(true); setCreateMsg("");
    try {
      const body: any = {
        customer_name:     createForm.customer_name.trim(),
        customer_phone:    createForm.customer_phone.trim(),
        debt_type:         createForm.debt_type,
        total_amount:      Number(createForm.total_amount),
        down_payment:      Number(createForm.down_payment) || 0,
        installment_count: Number(createForm.installment_count) || 1,
        first_due_date:    createForm.first_due_date,
        source_ref:        createForm.source_ref.trim(),
        note:              createForm.note.trim(),
        // branch จาก Sales row (ถ้าไม่มีจะใช้ default ของ user ใน API)
        ...(createForm.branch_id   && { branch_id:   createForm.branch_id }),
        ...(createForm.branch_name && { branch_name: createForm.branch_name }),
      };
      const res  = await fetch("/api/ar/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateMsg(`✓ สร้างสำเร็จ — ${data.debt_id} (${data.installments_created} งวด)`);
      setTimeout(() => { setCreateOpen(false); resetCreate(); load(); }, 1500);
    } catch (e: any) { setCreateMsg(`❌ ${e.message}`); }
    finally { setCreating(false); }
  }

  function resetCreate() {
    setCreateForm({ customer_name: "", customer_phone: "", debt_type: "credit",
      total_amount: "", down_payment: "", installment_count: "1",
      first_due_date: "", source_ref: "", note: "",
      branch_id: "", branch_name: "" });
    setCreateMsg("");
    setSalesPickerOpen(false);
    setSalesRows([]);
    setSalesFetched(false);
    setSalesSearch("");
    setSalesError("");
    setSalesNoDB(false);
    setSalesNoSheet(false);
    setSalesIncludeAll(false);
    setSelectedSalesRow(null);
    // ไม่ reset salesManualId — ให้จำ ID ที่เคยใส่ไว้
  }

  // ── Fetch sales rows ───────────────────────────────────────────────────────
  async function fetchSales() {
    if (salesLoading) return;
    setSalesLoading(true);
    setSalesFetched(false);
    setSalesError("");
    setSalesNoDB(false);
    setSalesNoSheet(false);
    setSalesRows([]);
    try {
      const params = new URLSearchParams();
      if (salesFrom)        params.set("from",          salesFrom);
      if (salesTo)          params.set("to",            salesTo);
      if (salesManualId)    params.set("spreadsheetId", salesManualId.trim());
      if (salesIncludeAll)  params.set("includeAll",    "true");
      const res  = await fetch(`/api/ar/sales-picker?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.noDB)     setSalesNoDB(true);
      if (data.noSheet)  setSalesNoSheet(true);
      setSalesRows(data.sales || []);
      setSalesFetched(true);
    } catch (e: any) {
      setSalesError(e.message);
      setSalesFetched(true);
    } finally {
      setSalesLoading(false);
    }
  }

  function selectSalesRow(r: SalesRow) {
    // source_ref บอกว่าหนี้นี้มาจาก transaction ไหน
    const ref = [
      r.date,
      r.program || null,
      `฿${r.amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`,
    ].filter(Boolean).join(" · ");

    setCreateForm((f) => ({
      ...f,
      customer_name:  r.customer_name,
      customer_phone: r.customer_phone || f.customer_phone,
      total_amount:   String(r.outstanding > 0 ? r.outstanding : r.amount),
      source_ref:     ref,
      branch_id:      r.branch_id,
      branch_name:    r.branch,
    }));
    setSelectedSalesRow(r);
    setSalesPickerOpen(false);
  }

  // ── Handle pay ────────────────────────────────────────────────────────────
  async function handlePay() {
    if (!payDebt || !payForm.amount) return;
    setPaying(true); setPayMsg("");
    try {
      const body = {
        debt_id:        payDebt.debt_id,
        inst_id:        selInst?.inst_id || "",
        amount:         Number(payForm.amount),
        payment_method: payForm.payment_method,
        note:           payForm.note.trim(),
      };
      const res  = await fetch("/api/ar/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayMsg(`✓ รับชำระ ฿${fmt(Number(payForm.amount))} สำเร็จ — คงเหลือ ฿${fmt(data.new_remaining)}`);
      setTimeout(() => { setPayDebt(null); load(); }, 1600);
    } catch (e: any) { setPayMsg(`❌ ${e.message}`); }
    finally { setPaying(false); }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const isSA       = role === "SUPER_ADMIN";
  const allBranches = isSA ? Array.from(new Set(debts.map((d) => d.branch_name).filter(Boolean))).sort() : [];

  let displayed = debts;
  if (statusFilter !== "all")  displayed = displayed.filter((d) => d.status === statusFilter);
  if (branchFilter)            displayed = displayed.filter((d) => d.branch_name === branchFilter);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    displayed = displayed.filter((d) =>
      d.customer_name.toLowerCase().includes(q) ||
      d.customer_phone.includes(q) ||
      d.debt_id.toLowerCase().includes(q) ||
      (d.source_ref || "").toLowerCase().includes(q)
    );
  }

  const kpiActive   = debts.filter((d) => d.status === "active").length;
  const kpiOverdue  = debts.filter((d) => d.status === "overdue").length;
  const kpiSettled  = debts.filter((d) => d.status === "settled").length;
  const kpiTotal    = debts.filter((d) => d.status !== "settled").reduce((s, d) => s + d.remaining, 0);
  const kpiDue7     = debts.filter((d) => {
    const days = daysUntil(d.next_due_date);
    return days !== null && days >= 0 && days <= 7 && d.status !== "settled";
  }).length;

  // ── Sales picker: client-side search filter ───────────────────────────────
  const filteredSalesRows = salesSearch.trim()
    ? salesRows.filter((r) => {
        const q = salesSearch.toLowerCase();
        return r.customer_name.toLowerCase().includes(q) || r.program.toLowerCase().includes(q);
      })
    : salesRows;

  // ── Installment progress bar ───────────────────────────────────────────────
  function progressPct(d: Debt) {
    if (d.total_amount <= 0) return 0;
    return Math.min(100, Math.round((d.paid_amount / d.total_amount) * 100));
  }

  // ── ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-indigo-600/6 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center shrink-0" style={{ boxShadow: "0 8px 24px rgba(59,130,246,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">ลูกหนี้ / AR</h1>
          <p className="text-slate-500 text-xs">Accounts Receivable</p>
        </div>
        {/* ลิ้งไป Accounting Dashboard */}
        {spreadsheetId && (
          <button
            onClick={() => router.push(`/ERP/accounting-demo?spreadsheetId=${encodeURIComponent(spreadsheetId)}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
            title="ดู Accounting Dashboard">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <span className="hidden sm:inline">Accounting</span>
          </button>
        )}
        <button
          onClick={() => {
            resetCreate();
            const today = new Date().toISOString().slice(0, 10);
            setSalesFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
            setSalesTo(today);
            setCreateOpen(true);
          }}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-400 text-white text-sm font-semibold hover:opacity-90 transition-all"
          style={{ boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">สร้างลูกหนี้</span>
        </button>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="sm:col-span-2 bg-blue-500/[0.08] border border-blue-500/20 rounded-2xl p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">ยอดค้างรวม</p>
            <p className="text-2xl font-bold text-blue-400">฿{fmt(kpiTotal)}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">จากลูกหนี้ทั้งหมด {debts.filter(d => d.status !== "settled").length} ราย</p>
          </div>
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">ค้างอยู่</p>
            <p className="text-2xl font-bold text-white">{kpiActive}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">ราย</p>
          </div>
          <div className={`border rounded-2xl p-4 ${kpiOverdue > 0 ? "bg-red-500/[0.07] border-red-500/20" : "bg-white/[0.04] border-white/10"}`}>
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">เกินกำหนด</p>
            <p className={`text-2xl font-bold ${kpiOverdue > 0 ? "text-red-400" : "text-slate-600"}`}>{kpiOverdue}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">ราย</p>
          </div>
          <div className={`border rounded-2xl p-4 ${kpiDue7 > 0 ? "bg-amber-500/[0.07] border-amber-500/20" : "bg-white/[0.04] border-white/10"}`}>
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">ครบใน 7 วัน</p>
            <p className={`text-2xl font-bold ${kpiDue7 > 0 ? "text-amber-400" : "text-slate-600"}`}>{kpiDue7}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">ราย</p>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ค้นหาชื่อ / เบอร์ / ID..."
              className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all" />
          </div>

          {/* Status chips */}
          <div className="flex gap-1 flex-wrap">
            {([
              { k: "all",     label: "ทั้งหมด" },
              { k: "active",  label: "ค้างอยู่" },
              { k: "overdue", label: "⚠ เกินกำหนด" },
              { k: "settled", label: "✓ ชำระครบ" },
            ] as { k: StatusFilter; label: string }[]).map(({ k, label }) => (
              <button key={k} onClick={() => setStatusFilter(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  statusFilter === k ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                }`}>{label}</button>
            ))}
          </div>

          {/* Branch filter (SA) */}
          {isSA && allBranches.length > 1 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-[#0d1526] border border-white/10 text-sm rounded-xl px-3 py-2 focus:outline-none min-w-[130px]"
              style={{ color: branchFilter ? "#fff" : "#475569" }}>
              <option value="">ทุกสาขา</option>
              {allBranches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Clear */}
          {(searchQ || statusFilter !== "all" || branchFilter) && (
            <button onClick={() => { setSearchQ(""); setStatusFilter("all"); setBranchFilter(""); }}
              className="px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/15 transition-all">
              ล้าง
            </button>
          )}
          <span className="text-xs text-slate-500 ml-auto">{displayed.length} รายการ{displayed.length !== debts.length ? ` / ${debts.length}` : ""}</span>
        </div>

        {/* ── Table card ── */}
        <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-9 h-9 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <p className="text-slate-500 text-sm">
                {debts.length === 0 ? "ยังไม่มีรายการลูกหนี้" : "ไม่พบรายการที่ตรงกับตัวกรอง"}
              </p>
              {debts.length === 0 && (
                <button onClick={() => { setCreateOpen(true); resetCreate(); }}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-all">
                  + สร้างลูกหนี้แรก
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="px-4 py-3.5 text-slate-500">ลูกค้า</th>
                    <th className="px-4 py-3.5 text-slate-500 hidden sm:table-cell">ประเภท</th>
                    <th className="px-4 py-3.5 text-right text-slate-500">ยอดรวม</th>
                    <th className="px-4 py-3.5 hidden sm:table-cell">ความคืบหน้า</th>
                    <th className="px-4 py-3.5 text-right text-slate-500">คงเหลือ</th>
                    <th className="px-4 py-3.5 text-slate-500 hidden md:table-cell">งวดถัดไป</th>
                    {isSA && <th className="px-4 py-3.5 text-slate-500 hidden md:table-cell">สาขา</th>}
                    <th className="px-4 py-3.5 text-slate-500">สถานะ</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((d) => {
                    const pct  = progressPct(d);
                    const days = daysUntil(d.next_due_date);
                    const isDue = days !== null && days <= 7 && days >= 0 && d.status !== "settled";
                    return (
                      <tr key={d.debt_id} className={`border-t border-white/5 hover:bg-white/[0.025] transition-colors ${d.status === "settled" ? "opacity-50" : ""}`}>
                        {/* ลูกค้า */}
                        <td className="px-4 py-3.5">
                          <p className="text-white font-medium text-sm">{d.customer_name}</p>
                          {d.customer_phone && <p className="text-xs text-slate-500">{d.customer_phone}</p>}
                          {d.source_ref && <p className="text-xs text-slate-600 mt-0.5">ref: {d.source_ref}</p>}
                          {/* Mobile: debt type badge */}
                          <span className="sm:hidden inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-slate-400 border border-white/10">
                            {debtTypeLabel(d.debt_type)}
                          </span>
                        </td>

                        {/* ประเภท */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${
                            d.debt_type === "installment"
                              ? "bg-violet-500/15 text-violet-300 border-violet-500/20"
                              : "bg-slate-500/15 text-slate-300 border-slate-500/20"
                          }`}>
                            {debtTypeLabel(d.debt_type)}
                          </span>
                          {d.debt_type === "installment" && (
                            <p className="text-xs text-slate-600 mt-0.5">{d.pending_count}/{d.installment_count} งวด</p>
                          )}
                        </td>

                        {/* ยอดรวม */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-slate-400 text-sm">฿{fmt(d.total_amount)}</span>
                        </td>

                        {/* Progress bar */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <div className="min-w-[80px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-500">{pct}%</span>
                              <span className="text-[10px] text-slate-500">฿{fmt(d.paid_amount)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-400" : d.status === "overdue" ? "bg-red-400" : "bg-blue-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* คงเหลือ */}
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-bold text-base ${d.status === "settled" ? "text-slate-600" : d.status === "overdue" ? "text-red-400" : "text-white"}`}>
                            ฿{fmt(d.remaining)}
                          </span>
                        </td>

                        {/* งวดถัดไป */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {d.next_due_date && d.status !== "settled" ? (
                            <div>
                              <p className={`text-xs font-medium ${isDue ? "text-amber-400" : "text-slate-400"}`}>
                                {isDue && "⏰ "}{d.next_due_date}
                              </p>
                              <p className="text-xs text-slate-600">
                                ฿{fmt(d.next_due_amount ?? 0)}
                                {days !== null && (
                                  <span className={`ml-1 ${days < 0 ? "text-red-400" : days <= 3 ? "text-amber-400" : "text-slate-600"}`}>
                                    ({days < 0 ? `เกิน ${Math.abs(days)} วัน` : days === 0 ? "วันนี้" : `อีก ${days} วัน`})
                                  </span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* สาขา */}
                        {isSA && (
                          <td className="px-4 py-3.5 text-xs text-slate-500 hidden md:table-cell">
                            {d.branch_name || "—"}
                          </td>
                        )}

                        {/* สถานะ */}
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${statusBadge(d.status)}`}>
                            {statusLabel(d.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          {d.status !== "settled" && (
                            <button onClick={() => openPay(d)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 text-xs font-medium transition-all whitespace-nowrap">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                              </svg>
                              <span className="hidden sm:inline">รับชำระ</span>
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

        {/* ── Settled summary ── */}
        {kpiSettled > 0 && (
          <p className="text-center text-xs text-slate-600 mt-4">
            ✓ ชำระครบแล้ว {kpiSettled} ราย {statusFilter !== "settled" ? "(กด 'ชำระครบ' ด้านบนเพื่อดู)" : ""}
          </p>
        )}
      </main>

      {/* ════════════════════════════════════════════════════
          MODAL: สร้างลูกหนี้
      ════════════════════════════════════════════════════ */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setCreateOpen(false); resetCreate(); } }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-lg p-6 relative overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-base">สร้างรายการลูกหนี้</h3>
              <button onClick={() => { setCreateOpen(false); resetCreate(); }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="space-y-4">

              {/* ══ Sales Picker ══════════════════════════════════════════════ */}
              <div className="border border-white/10 rounded-2xl overflow-hidden">
                {/* Toggle header */}
                <button
                  type="button"
                  onClick={() => setSalesPickerOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <span className="text-sm font-medium text-slate-300">ดึงจากรายการขาย</span>
                    {selectedSalesRow && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                        ✓ {selectedSalesRow.customer_name}
                      </span>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-slate-500 transition-transform ${salesPickerOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>

                {/* Picker body */}
                {salesPickerOpen && (
                  <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] space-y-3 bg-white/[0.01]">

                    {/* Period */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 mb-1 block">ตั้งแต่</label>
                        <input type="date" value={salesFrom}
                          onChange={(e) => setSalesFrom(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 mb-1 block">ถึง</label>
                        <input type="date" value={salesTo}
                          onChange={(e) => setSalesTo(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                      <button type="button" onClick={fetchSales} disabled={salesLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-all whitespace-nowrap flex items-center gap-1.5">
                        {salesLoading
                          ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        }
                        ดึงข้อมูล
                      </button>
                    </div>

                    {/* Options row */}
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => setSalesIncludeAll((v) => !v)}
                          className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${salesIncludeAll ? "bg-emerald-500/60" : "bg-white/10"}`}>
                          <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform ${salesIncludeAll ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-[10px] text-slate-500">แสดงทุกรายการ (รวมที่ชำระแล้ว)</span>
                      </label>
                    </div>

                    {/* noDB / noSheet — manual spreadsheetId input */}
                    {salesFetched && (salesNoDB || salesNoSheet) && (
                      <div className="bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] text-amber-400 font-medium">
                          {salesNoDB
                            ? "⚠ ไม่พบการตั้งค่า Sales Database"
                            : "⚠ ไม่พบ sheet \"HelperS\" ใน spreadsheet นี้"}
                        </p>
                        <p className="text-[10px] text-slate-500">ลองระบุ Spreadsheet ID ของ Sales ด้วยตนเอง</p>
                        <input type="text" value={salesManualId}
                          onChange={(e) => setSalesManualId(e.target.value)}
                          placeholder="Spreadsheet ID หรือ URL เต็ม"
                          className="w-full bg-white/5 border border-amber-500/20 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50 transition-all font-mono" />
                        <button type="button" onClick={fetchSales} disabled={salesLoading || !salesManualId.trim()}
                          className="w-full py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 disabled:opacity-40 transition-all">
                          ลองใหม่ด้วย ID นี้
                        </button>
                      </div>
                    )}

                    {/* Error */}
                    {salesError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">❌ {salesError}</p>
                    )}

                    {/* Search (client-side) */}
                    {salesRows.length > 0 && (
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                        </svg>
                        <input type="text" value={salesSearch}
                          onChange={(e) => setSalesSearch(e.target.value)}
                          placeholder="ค้นหาชื่อลูกค้า / โปรแกรม..."
                          className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 transition-all" />
                      </div>
                    )}

                    {/* Empty state (after fetch, no results, no error) */}
                    {salesFetched && !salesError && !salesNoDB && !salesNoSheet && filteredSalesRows.length === 0 && (
                      <div className="text-center py-4 space-y-1">
                        <p className="text-slate-500 text-xs">
                          {salesRows.length === 0
                            ? salesIncludeAll
                              ? "ไม่พบรายการขายในช่วงเวลานี้"
                              : "ไม่พบรายการที่ค้างชำระในช่วงนี้"
                            : "ไม่พบรายการที่ตรงกัน"}
                        </p>
                        {salesRows.length === 0 && !salesIncludeAll && (
                          <button type="button" onClick={() => { setSalesIncludeAll(true); }}
                            className="text-[10px] text-emerald-400 hover:underline">
                            ลองแสดงทุกรายการ (รวมที่ชำระแล้ว)
                          </button>
                        )}
                      </div>
                    )}

                    {/* Results list */}
                    {filteredSalesRows.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                        <p className="text-[10px] text-slate-500 pb-0.5">
                          {filteredSalesRows.length} รายการ
                          {salesSearch && ` (กรองจาก ${salesRows.length})`}
                          {!salesIncludeAll && " · เฉพาะค้างชำระ"}
                        </p>
                        {filteredSalesRows.map((r, i) => (
                          <button key={i} type="button" onClick={() => selectSalesRow(r)}
                            className="w-full text-left px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] transition-all group">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-200 transition-colors">
                                  {r.customer_name}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                                  {r.date}{r.program ? ` · ${r.program}` : ""}{r.branch ? ` · ${r.branch}` : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                {r.outstanding > 0 ? (
                                  <>
                                    <p className="text-xs font-bold text-amber-400">฿{fmt(r.outstanding)}</p>
                                    <p className="text-[10px] text-slate-600">ค้างชำระ / ฿{fmt(r.amount)}</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-bold text-emerald-400">฿{fmt(r.amount)}</p>
                                    <p className="text-[10px] text-slate-600">ชำระครบแล้ว</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* ══ /Sales Picker ════════════════════════════════════════════ */}

              {/* ประเภท */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">ประเภทหนี้ <span className="text-red-400">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "installment", label: "ผ่อนจ่ายงวด", desc: "แบ่งเป็น N งวด" },
                    { v: "credit",      label: "ค้างจ่าย",     desc: "จ่ายคืนเมื่อไหรก็ได้" },
                  ] as const).map(({ v, label, desc }) => (
                    <button key={v} onClick={() => setCreateForm((f) => ({ ...f, debt_type: v }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        createForm.debt_type === v
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                          : "bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20"
                      }`}>
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-[11px] opacity-70 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ชื่อลูกค้า + เบอร์ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">ชื่อลูกค้า <span className="text-red-400">*</span></label>
                  <input type="text" value={createForm.customer_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, customer_name: e.target.value }))}
                    placeholder="ชื่อ-นามสกุล" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">เบอร์โทร</label>
                  <input type="tel" value={createForm.customer_phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="08X-XXX-XXXX" className={inputCls} />
                </div>
              </div>

              {/* ยอดทั้งหมด + เงินดาวน์ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">ยอดหนี้ทั้งหมด (฿) <span className="text-red-400">*</span></label>
                  <input type="number" min="0" value={createForm.total_amount}
                    onChange={(e) => setCreateForm((f) => ({ ...f, total_amount: e.target.value }))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">ชำระมาแล้ว / ดาวน์ (฿)</label>
                  <input type="number" min="0" value={createForm.down_payment}
                    onChange={(e) => setCreateForm((f) => ({ ...f, down_payment: e.target.value }))}
                    placeholder="0" className={inputCls} />
                </div>
              </div>

              {/* Preview remaining */}
              {createForm.total_amount && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">ยอดคงค้าง</span>
                  <span className="text-blue-400 font-bold text-lg">
                    ฿{fmt(Math.max(0, Number(createForm.total_amount) - Number(createForm.down_payment || 0)))}
                  </span>
                </div>
              )}

              {/* งวด + วันเริ่ม */}
              {createForm.debt_type === "installment" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">จำนวนงวด <span className="text-red-400">*</span></label>
                    <input type="number" min="1" max="60" value={createForm.installment_count}
                      onChange={(e) => setCreateForm((f) => ({ ...f, installment_count: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">วันครบกำหนดงวดแรก <span className="text-red-400">*</span></label>
                    <input type="date" value={createForm.first_due_date}
                      onChange={(e) => setCreateForm((f) => ({ ...f, first_due_date: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
              )}

              {createForm.debt_type === "credit" && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">วันครบกำหนด <span className="text-red-400">*</span></label>
                  <input type="date" value={createForm.first_due_date}
                    onChange={(e) => setCreateForm((f) => ({ ...f, first_due_date: e.target.value }))}
                    className={inputCls} />
                </div>
              )}

              {/* Preview installment amount */}
              {createForm.debt_type === "installment" && createForm.total_amount && Number(createForm.installment_count) > 0 && (
                <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1">ตัวอย่างตารางงวด</p>
                  <p className="text-violet-300 text-sm font-semibold">
                    {createForm.installment_count} งวด ๆ ละ ≈ ฿{fmt(
                      Math.floor((
                        Math.max(0, Number(createForm.total_amount) - Number(createForm.down_payment || 0))
                        / Math.max(1, Number(createForm.installment_count))
                      ) * 100) / 100
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">ทุก 1 เดือน นับจากวันที่เลือก</p>
                </div>
              )}

              {/* สาขา (จาก Sales row) */}
              {createForm.branch_name && (
                <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500">สาขาที่เกิดรายการ</p>
                    <p className="text-sm font-semibold text-white truncate">{createForm.branch_name}</p>
                  </div>
                  {createForm.branch_id && (
                    <span className="text-[10px] text-slate-600 font-mono shrink-0">{createForm.branch_id}</span>
                  )}
                  <button type="button" onClick={() => setCreateForm((f) => ({ ...f, branch_id: "", branch_name: "" }))}
                    className="text-slate-600 hover:text-slate-400 transition-colors shrink-0" title="ล้าง">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* อ้างอิง / ที่มาของหนี้ */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">
                  ที่มาของหนี้
                  {selectedSalesRow && <span className="ml-1 text-emerald-400 text-[10px]">· จาก Sales</span>}
                </label>
                <input type="text" value={createForm.source_ref}
                  onChange={(e) => setCreateForm((f) => ({ ...f, source_ref: e.target.value }))}
                  placeholder="วันที่ · โปรแกรม · ฿ยอด" className={inputCls} />
                {selectedSalesRow && createForm.source_ref && (
                  <p className="text-[10px] text-slate-600 mt-1 pl-1">
                    จาก: {selectedSalesRow.customer_name} — {selectedSalesRow.date}
                    {selectedSalesRow.program ? ` · ${selectedSalesRow.program}` : ""}
                    {" · ฿"}{selectedSalesRow.amount.toLocaleString("th-TH")} (ค้าง ฿{selectedSalesRow.outstanding.toLocaleString("th-TH")})
                  </p>
                )}
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">หมายเหตุ</label>
                <input type="text" value={createForm.note}
                  onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม" className={inputCls} />
              </div>
            </div>

            {createMsg && (
              <p className={`mt-4 text-sm text-center ${createMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{createMsg}</p>
            )}

            <button onClick={handleCreate} disabled={creating}
              className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {creating ? "กำลังสร้าง..." : "สร้างรายการลูกหนี้"}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL: รับชำระ (แสดงตารางงวด)
      ════════════════════════════════════════════════════ */}
      {payDebt && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPayDebt(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-lg p-6 relative overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-base">รับชำระ</h3>
              <button onClick={() => setPayDebt(null)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Debt summary */}
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold">{payDebt.customer_name}</p>
                  {payDebt.customer_phone && <p className="text-xs text-slate-500 mt-0.5">{payDebt.customer_phone}</p>}
                  <p className="text-xs text-slate-600 mt-1 font-mono">{payDebt.debt_id}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge(payDebt.status)}`}>
                  {statusLabel(payDebt.status)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/5">
                <div>
                  <p className="text-[10px] text-slate-500">ยอดรวม</p>
                  <p className="text-sm font-semibold text-slate-300">฿{fmt(payDebt.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">ชำระแล้ว</p>
                  <p className="text-sm font-semibold text-emerald-400">฿{fmt(payDebt.paid_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">คงเหลือ</p>
                  <p className="text-sm font-semibold text-blue-400">฿{fmt(payDebt.remaining)}</p>
                </div>
              </div>
            </div>

            {/* ตารางงวด */}
            <div className="mb-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">ตารางงวด — เลือกงวดที่รับชำระ</p>
              {loadingInst ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500/20 border-t-blue-400 animate-spin" />
                </div>
              ) : installments.length === 0 ? (
                <p className="text-center text-slate-600 text-sm py-4">ไม่พบตารางงวด</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {installments.map((inst) => {
                    const isSelected = selInst?.inst_id === inst.inst_id;
                    const canPay = inst.status !== "paid";
                    return (
                      <button key={inst.inst_id} onClick={() => {
                        if (!canPay) return;
                        setSelInst(isSelected ? null : inst);
                        if (!isSelected) {
                          const leftToPay = inst.amount - inst.paid_amount;
                          setPayForm((f) => ({ ...f, amount: String(Math.max(0, leftToPay)) }));
                        }
                      }}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          !canPay ? "opacity-40 cursor-not-allowed bg-white/[0.02] border-white/5" :
                          isSelected ? "bg-blue-500/15 border-blue-500/40" :
                          "bg-white/[0.03] border-white/10 hover:border-white/20"
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected ? "border-blue-400 bg-blue-500/30 text-blue-300" :
                              inst.status === "paid" ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400" :
                              "border-white/20 text-slate-500"
                            }`}>
                              {inst.status === "paid" ? "✓" : inst.installment_no}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">งวดที่ {inst.installment_no}</p>
                              <p className="text-xs text-slate-500">ครบ {inst.due_date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">฿{fmt(inst.amount)}</p>
                            {inst.paid_amount > 0 && (
                              <p className="text-xs text-emerald-400">จ่ายแล้ว ฿{fmt(inst.paid_amount)}</p>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusBadge(inst.status)}`}>
                              {statusLabel(inst.status)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment form */}
            <div className="space-y-3 border-t border-white/5 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">ยอดชำระ (฿) <span className="text-red-400">*</span></label>
                  <input type="number" min="0.01" step="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">วิธีชำระ</label>
                  <select value={payForm.payment_method}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                    className={selectCls}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">หมายเหตุ</label>
                <input type="text" value={payForm.note}
                  onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="รายละเอียดการชำระ" className={inputCls} />
              </div>
            </div>

            {payMsg && (
              <p className={`mt-4 text-sm text-center ${payMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{payMsg}</p>
            )}

            <button onClick={handlePay} disabled={paying || !payForm.amount}
              className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {paying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              {paying ? "กำลังบันทึก..." : `รับชำระ ${payForm.amount ? `฿${fmt(Number(payForm.amount))}` : ""}`}
            </button>
          </div>
        </div>
      )}

      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
