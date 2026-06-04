"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface Lot {
  lot_id: string; product_id: string; product_name: string; category: string; brand: string;
  unit: string; qty_original: number; qty_remaining: number;
  expiry_date: string; purchase_date: string; supplier: string;
  cost_per_unit: number;
}
interface Branch { branchId: string; branchName: string; }
interface StockRequest {
  request_id: string; branch_id: string; branch_name: string;
  product_id: string; product_name: string; unit: string; qty_requested: number;
  qty_approved: string; lot_id: string; expiry_date: string;
  status: string; note: string; requested_by: string; requested_at: string;
}

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all";

function statusBadge(s: string) {
  if (s === "PENDING")  return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (s === "APPROVED") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (s === "REJECTED") return "bg-red-500/15 text-red-400 border-red-500/20";
  if (s === "REVERSED") return "bg-slate-500/15 text-slate-400 border-slate-500/20";
  return "bg-white/5 text-slate-400 border-white/10";
}

export default function InvCentralPage() {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab]             = useState<"stock" | "requests" | "history">("stock");
  const [lots, setLots]           = useState<Lot[]>([]);
  const [requests, setRequests]   = useState<StockRequest[]>([]);
  const [historyReqs, setHistoryReqs] = useState<StockRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // ── Approve modal ─────────────────────────────────────────────────
  const [approveReq, setApproveReq]       = useState<StockRequest | null>(null);
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [approveForm, setApproveForm]     = useState({ lot1_id: "", qty1: "", lot2_id: "", qty2: "", note: "" });
  const [approving, setApproving]         = useState(false);
  const [approveMsg, setApproveMsg]       = useState("");

  // ── Edit Lot modal ────────────────────────────────────────────────
  const [editLot, setEditLot]       = useState<Lot | null>(null);
  const [editLotForm, setEditLotForm] = useState({ qty_remaining: "", expiry_date: "", supplier: "" });
  const [editLotSaving, setEditLotSaving] = useState(false);
  const [editLotMsg, setEditLotMsg] = useState("");

  // ── Delete Lot modal ──────────────────────────────────────────────
  const [deleteLot, setDeleteLot] = useState<Lot | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // ── Edit Request modal ────────────────────────────────────────────
  const [editReq, setEditReq]   = useState<StockRequest | null>(null);
  const [editForm, setEditForm] = useState({ qty_requested: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg]   = useState("");

  // ── Undo modal ────────────────────────────────────────────────────
  const [undoReq, setUndoReq]   = useState<StockRequest | null>(null);
  const [undoing, setUndoing]   = useState(false);
  const [undoMsg, setUndoMsg]   = useState("");

  // ── Dispense modal (จ่ายตรงไปสาขา) ──────────────────────────────
  const [branches, setBranches]           = useState<Branch[]>([]);
  const [dispenseLot, setDispenseLot]     = useState<Lot | null>(null);
  const [dispenseForm, setDispenseForm]   = useState({ branch_id: "", qty: "", note: "" });
  const [dispensing, setDispensing]       = useState(false);
  const [dispenseMsg, setDispenseMsg]     = useState("");

  // ── Lost modal (ยาหาย) ───────────────────────────────────────────
  const [lostLot, setLostLot]     = useState<Lot | null>(null);
  const [lostForm, setLostForm]   = useState({ qty: "", note: "" });
  const [lostSaving, setLostSaving] = useState(false);
  const [lostMsg, setLostMsg]     = useState("");

  // ── Stock sort / filter ───────────────────────────────────────────
  type StockSort = "date_desc" | "date_asc" | "name_asc" | "name_desc" | "qty_asc" | "qty_desc";
  const [stockSort, setStockSort]           = useState<StockSort>("date_desc");
  const [stockQ, setStockQ]                 = useState("");
  const [stockCat, setStockCat]             = useState("");
  const [stockSupp, setStockSupp]           = useState("");
  const [stockShowEmpty, setStockShowEmpty] = useState(false);

  // ── Requests sort / filter ────────────────────────────────────────
  type ReqSort = "date_desc" | "date_asc" | "name_asc" | "name_desc";
  const [reqQ, setReqQ]             = useState("");
  const [reqBranch, setReqBranch]   = useState("");
  const [reqSort, setReqSort]       = useState<ReqSort>("date_desc");

  // ── History sort / filter ─────────────────────────────────────────
  type HistSort = "date_desc" | "date_asc" | "name_asc" | "name_desc";
  const [histQ, setHistQ]             = useState("");
  const [histBranch, setHistBranch]   = useState("");
  const [histStatus, setHistStatus]   = useState("");
  const [histSort, setHistSort]       = useState<HistSort>("date_desc");

  // ── Stock validation (approve modal) ─────────────────────────────
  const lot1          = availableLots.find((l) => l.lot_id === approveForm.lot1_id);
  const lot2          = availableLots.find((l) => l.lot_id === approveForm.lot2_id);
  const qty1Num       = Number(approveForm.qty1) || 0;
  const qty2Num       = Number(approveForm.qty2) || 0;
  const totalApproved = qty1Num + qty2Num;
  const lot1Short     = !!lot1 && qty1Num > lot1.qty_remaining;
  const lot2Short     = !!lot2 && qty2Num > lot2.qty_remaining;
  const spill         = lot1Short ? qty1Num - (lot1?.qty_remaining ?? 0) : 0;
  const showLot2      = lot1Short || !!approveForm.lot2_id;
  const canApprove    = !!approveForm.lot1_id && qty1Num > 0 && !lot1Short && !lot2Short && (approveForm.lot2_id ? qty2Num > 0 : true);

  // Auto-pick lot2 when shortfall appears
  useEffect(() => {
    if (lot1Short && !approveForm.lot2_id) {
      const next = availableLots.find((l) => l.lot_id !== approveForm.lot1_id);
      if (next) setApproveForm((f) => ({ ...f, lot2_id: next.lot_id, qty2: spill.toString() }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot1Short]);

  const load = useCallback(async () => {
    try {
      const [authRes, lotsRes, reqRes, branchRes] = await Promise.all([
        fetch("/api/auth/branch-check"),
        fetch("/api/inv/lots"),
        fetch("/api/inv/request"),
        fetch("/api/auth/branches"),
      ]);
      const auth = await authRes.json();
      if (auth.role !== "SUPER_ADMIN") { router.replace("/ERP/home-demo"); return; }
      setLots((await lotsRes.json()).lots || []);
      const allReqs: StockRequest[] = (await reqRes.json()).requests || [];
      setRequests(allReqs.filter((r) => r.status.toUpperCase() === "PENDING"));
      setHistoryReqs(allReqs.filter((r) => r.status.toUpperCase() !== "PENDING"));
      setBranches((await branchRes.json()).branches || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function openApprove(req: StockRequest) {
    setApproveReq(req);
    setApproveForm({ lot1_id: "", qty1: req.qty_requested.toString(), lot2_id: "", qty2: "", note: "" });
    setApproveMsg("");
    const qs   = req.product_id ? `?available=true&productId=${encodeURIComponent(req.product_id)}` : "?available=true";
    const data = await fetch(`/api/inv/lots${qs}`).then((r) => r.json());
    // Sort FEFO: earliest expiry first so dropdown shows them in order
    const sorted: Lot[] = (data.lots || []).sort((a: Lot, b: Lot) =>
      (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999")
    );
    setAvailableLots(sorted);
  }

  async function handleApprove(action: "approve" | "reject") {
    if (!approveReq) return;
    setApproving(true); setApproveMsg("");
    try {
      const body: any = { request_id: approveReq.request_id, action, note: approveForm.note };
      if (action === "approve") {
        const lots: { lot_id: string; qty: number }[] = [{ lot_id: approveForm.lot1_id, qty: qty1Num }];
        if (approveForm.lot2_id && qty2Num > 0) lots.push({ lot_id: approveForm.lot2_id, qty: qty2Num });
        body.lots = lots;
      }
      const res  = await fetch("/api/inv/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setApproveMsg(action === "approve" ? "✓ อนุมัติเรียบร้อย" : "✕ ปฏิเสธเรียบร้อย");
      setTimeout(() => { setApproveReq(null); setLoading(true); load(); }, 1200);
    } catch (e: any) { setApproveMsg(`❌ ${e.message}`); }
    finally { setApproving(false); }
  }

  async function handleUndo() {
    if (!undoReq) return;
    setUndoing(true); setUndoMsg("");
    try {
      const res  = await fetch("/api/inv/undo-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: undoReq.request_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const msg = data.warning ? `✓ Undo สำเร็จ · ${data.warning}` : `✓ Undo สำเร็จ — คืน ${data.restored_qty} ${undoReq.unit} กลับ Lot ${data.lot_id}`;
      setUndoMsg(msg);
      setTimeout(() => { setUndoReq(null); setLoading(true); load(); }, 2000);
    } catch (e: any) { setUndoMsg(`❌ ${e.message}`); }
    finally { setUndoing(false); }
  }

  async function handleDeleteLot() {
    if (!deleteLot) return;
    setDeleting(true); setDeleteMsg("");
    try {
      const res  = await fetch("/api/inv/lots", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: deleteLot.lot_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDeleteMsg("✓ ลบ Lot สำเร็จ");
      setTimeout(() => { setDeleteLot(null); setLoading(true); load(); }, 900);
    } catch (e: any) { setDeleteMsg(`❌ ${e.message}`); }
    finally { setDeleting(false); }
  }

  async function handleEditLotSave() {
    if (!editLot) return;
    setEditLotSaving(true); setEditLotMsg("");
    try {
      const res  = await fetch("/api/inv/lots", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_id:        editLot.lot_id,
          qty_remaining: Number(editLotForm.qty_remaining),
          expiry_date:   editLotForm.expiry_date,
          supplier:      editLotForm.supplier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEditLotMsg("✓ บันทึกสำเร็จ");
      setTimeout(() => { setEditLot(null); setLoading(true); load(); }, 900);
    } catch (e: any) { setEditLotMsg(`❌ ${e.message}`); }
    finally { setEditLotSaving(false); }
  }

  async function handleEditReqSave() {
    if (!editReq) return;
    setEditSaving(true); setEditMsg("");
    try {
      const res  = await fetch("/api/inv/request", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: editReq.request_id, qty_requested: Number(editForm.qty_requested), note: editForm.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEditMsg("✓ บันทึกสำเร็จ");
      setTimeout(() => { setEditReq(null); setLoading(true); load(); }, 900);
    } catch (e: any) { setEditMsg(`❌ ${e.message}`); }
    finally { setEditSaving(false); }
  }

  async function handleLost() {
    if (!lostLot) return;
    const qtyNum = Number(lostForm.qty);
    if (qtyNum <= 0 || qtyNum > lostLot.qty_remaining) {
      setLostMsg("❌ จำนวนไม่ถูกต้อง"); return;
    }
    setLostSaving(true); setLostMsg("");
    try {
      const res  = await fetch("/api/inv/central-lost", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lot_id: lostLot.lot_id, qty_lost: qtyNum, note: lostForm.note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setLostMsg(`✓ บันทึกยาหาย ${qtyNum} ${lostLot.unit} สำเร็จ`);
      setTimeout(() => { setLostLot(null); setLoading(true); load(); }, 1500);
    } catch (e: any) { setLostMsg(`❌ ${e.message}`); }
    finally { setLostSaving(false); }
  }

  async function handleDispense() {
    if (!dispenseLot || !dispenseForm.branch_id || !dispenseForm.qty) return;
    const qtyNum = Number(dispenseForm.qty);
    if (qtyNum <= 0 || qtyNum > dispenseLot.qty_remaining) {
      setDispenseMsg("❌ จำนวนไม่ถูกต้อง");
      return;
    }
    setDispensing(true); setDispenseMsg("");
    try {
      const res  = await fetch("/api/inv/dispense", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: dispenseForm.branch_id,
          lot_id:    dispenseLot.lot_id,
          qty:       qtyNum,
          note:      dispenseForm.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const branchName = branches.find((b) => b.branchId === dispenseForm.branch_id)?.branchName || dispenseForm.branch_id;
      setDispenseMsg(`✓ จ่ายไปสาขา ${branchName} แล้ว ${qtyNum} ${dispenseLot.unit}`);
      setTimeout(() => { setDispenseLot(null); setLoading(true); load(); }, 1500);
    } catch (e: any) { setDispenseMsg(`❌ ${e.message}`); }
    finally { setDispensing(false); }
  }

  const today = new Date();
  const warn30 = new Date(today); warn30.setDate(today.getDate() + 30);

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
        <div className="absolute bottom-[-20%] right-[-5%] w-[350px] h-[350px] rounded-full bg-teal-600/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg" style={{ boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">คลังกลาง (Central INV)</h1>
          <p className="text-slate-500 text-xs">Super Admin only</p>
        </div>
        <button onClick={() => router.push("/ERP/inv/purchase")}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-sm font-semibold hover:opacity-90 transition-all"
          style={{ boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          <span className="hidden sm:inline">สั่งซื้อ</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="relative z-10 border-b border-white/5 bg-white/[0.01] px-3 sm:px-6">
        <div className="flex gap-1">
          <button onClick={() => setTab("stock")}
            className={`px-3 sm:px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${tab === "stock" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <span className="hidden sm:inline">Stock คลังกลาง ({lots.length})</span>
            <span className="sm:hidden">Stock</span>
          </button>
          <button onClick={() => setTab("requests")}
            className={`px-3 sm:px-5 py-3.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${tab === "requests" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <span className="hidden sm:inline">Pending Requests</span>
            <span className="sm:hidden">คำขอ</span>
            {requests.length > 0 && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full font-semibold">{requests.length}</span>}
          </button>
          <button onClick={() => setTab("history")}
            className={`px-3 sm:px-5 py-3.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${tab === "history" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            ประวัติ
            {historyReqs.length > 0 && <span className="px-2 py-0.5 bg-white/10 text-slate-400 text-xs rounded-full">{historyReqs.length}</span>}
          </button>
        </div>
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {/* ── Stock tab ── */}
        {tab === "stock" && (() => {
          const activeLots  = lots.filter((l) => l.qty_remaining > 0);
          const totalValue  = activeLots.reduce((s, l) => s + l.qty_remaining * (l.cost_per_unit || 0), 0);
          const uniqueSKUs  = new Set(activeLots.map((l) => l.product_id)).size;
          const warn30Date  = new Date(); warn30Date.setDate(warn30Date.getDate() + 30);
          const expiringCount = activeLots.filter((l) => {
            if (!l.expiry_date) return false;
            return new Date(l.expiry_date) <= warn30Date;
          }).length;

          // ── Filter options ────────────────────────────────────────
          const cats  = Array.from(new Set(lots.map((l) => l.category).filter(Boolean))).sort();
          const supps = Array.from(new Set(lots.map((l) => l.supplier).filter(Boolean))).sort();

          // ── Apply filters ─────────────────────────────────────────
          let displayLots = stockShowEmpty ? lots : lots.filter((l) => l.qty_remaining > 0);
          if (stockQ) {
            const q = stockQ.toLowerCase();
            displayLots = displayLots.filter((l) =>
              l.lot_id.toLowerCase().includes(q) ||
              l.product_name.toLowerCase().includes(q) ||
              (l.brand || "").toLowerCase().includes(q)
            );
          }
          if (stockCat)  displayLots = displayLots.filter((l) => l.category === stockCat);
          if (stockSupp) displayLots = displayLots.filter((l) => l.supplier === stockSupp);

          // ── Apply sort ────────────────────────────────────────────
          displayLots = [...displayLots].sort((a, b) => {
            switch (stockSort) {
              case "date_asc":  return a.lot_id.localeCompare(b.lot_id);
              case "date_desc": return b.lot_id.localeCompare(a.lot_id);
              case "name_asc":  return a.product_name.localeCompare(b.product_name, "th");
              case "name_desc": return b.product_name.localeCompare(a.product_name, "th");
              case "qty_asc":   return a.qty_remaining - b.qty_remaining;
              case "qty_desc":  return b.qty_remaining - a.qty_remaining;
              default: return 0;
            }
          });

          // ── Sort header helper ────────────────────────────────────
          function SortBtn({ asc, desc, label }: { asc: StockSort; desc: StockSort; label: string }) {
            const active = stockSort === asc || stockSort === desc;
            const isAsc  = stockSort === asc;
            return (
              <button
                onClick={() => setStockSort(active ? (isAsc ? desc : asc) : desc)}
                className={`flex items-center gap-1 group transition-colors ${active ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>
                {label}
                <span className="flex flex-col gap-[1px] text-[8px] leading-none">
                  <span className={active && isAsc ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-500"}>▲</span>
                  <span className={active && !isAsc ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-500"}>▼</span>
                </span>
              </button>
            );
          }

          return (
          <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl p-4">
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">มูลค่าสต๊อครวม</p>
              <p className="text-xl font-bold text-emerald-400">฿{totalValue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Lots ที่มีของ</p>
              <p className="text-xl font-bold text-white">{activeLots.length}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">จากทั้งหมด {lots.length} lots</p>
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">SKU ในคลัง</p>
              <p className="text-xl font-bold text-white">{uniqueSKUs}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">ชนิดสินค้า</p>
            </div>
            <div className={`border rounded-2xl p-4 ${expiringCount > 0 ? "bg-red-500/[0.07] border-red-500/20" : "bg-white/[0.04] border-white/10"}`}>
              <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">ใกล้หมดอายุ</p>
              <p className={`text-xl font-bold ${expiringCount > 0 ? "text-red-400" : "text-slate-600"}`}>{expiringCount}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">ใน 30 วัน</p>
            </div>
          </div>

          {/* ── Filter bar ── */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input
                type="text"
                value={stockQ}
                onChange={(e) => setStockQ(e.target.value)}
                placeholder="ค้นหา Lot ID / สินค้า..."
                className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>

            {/* Category */}
            <select
              value={stockCat}
              onChange={(e) => setStockCat(e.target.value)}
              className="bg-[#0d1526] border border-white/10 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500/50 transition-all min-w-[120px]"
              style={{ color: stockCat ? "#fff" : "#475569" }}>
              <option value="">หมวดทั้งหมด</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Supplier */}
            <select
              value={stockSupp}
              onChange={(e) => setStockSupp(e.target.value)}
              className="bg-[#0d1526] border border-white/10 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500/50 transition-all min-w-[140px]"
              style={{ color: stockSupp ? "#fff" : "#475569" }}>
              <option value="">Supplier ทั้งหมด</option>
              {supps.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Show empty toggle */}
            <button
              onClick={() => setStockShowEmpty((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                stockShowEmpty
                  ? "bg-slate-500/15 border-slate-500/30 text-slate-300"
                  : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20"
              }`}>
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${stockShowEmpty ? "bg-slate-400 border-slate-400" : "border-slate-600"}`}>
                {stockShowEmpty && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </span>
              แสดง Lots หมด
            </button>

            {/* Active filter count + clear */}
            {(stockQ || stockCat || stockSupp || stockShowEmpty) && (
              <button
                onClick={() => { setStockQ(""); setStockCat(""); setStockSupp(""); setStockShowEmpty(false); }}
                className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-all">
                ล้างตัวกรอง
              </button>
            )}

            {/* Result count */}
            <span className="text-xs text-slate-500 ml-auto">
              {displayLots.length} รายการ{displayLots.length !== lots.length ? ` / ${lots.length}` : ""}
            </span>
          </div>

          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="px-4 py-3.5">
                      <SortBtn asc="date_asc" desc="date_desc" label="Lot ID" />
                    </th>
                    <th className="px-4 py-3.5">
                      <SortBtn asc="name_asc" desc="name_desc" label="สินค้า" />
                    </th>
                    <th className="px-4 py-3.5 text-slate-500 hidden md:table-cell">หมวด</th>
                    <th className="px-4 py-3.5 text-right">
                      <SortBtn asc="qty_asc" desc="qty_desc" label="คงเหลือ" />
                    </th>
                    <th className="px-4 py-3.5 text-right text-slate-500 hidden sm:table-cell">ต้นฉบับ</th>
                    <th className="px-4 py-3.5 text-slate-500 hidden sm:table-cell">หมดอายุ</th>
                    <th className="px-4 py-3.5 text-slate-500 hidden md:table-cell">Supplier</th>
                    <th className="px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {displayLots.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-600">
                      {lots.length === 0 ? "ยังไม่มีสต๊อคในคลังกลาง" : "ไม่พบรายการที่ตรงกับตัวกรอง"}
                    </td></tr>
                  ) : displayLots.map((l) => {
                    const expDate = l.expiry_date ? new Date(l.expiry_date) : null;
                    const isWarn  = expDate ? expDate <= warn30 : false;
                    const isEmpty = l.qty_remaining === 0;
                    return (
                      <tr key={l.lot_id} className={`border-t border-white/5 hover:bg-white/[0.03] transition-colors ${isEmpty ? "opacity-30" : ""}`}>
                        <td className="px-4 py-3.5 font-mono text-xs text-emerald-400">{l.lot_id}</td>
                        <td className="px-4 py-3.5">
                          <p className="text-white font-medium text-sm">{l.product_name}</p>
                          {l.brand && <p className="text-xs text-slate-500">{l.brand}</p>}
                          {/* Mobile-only: show expiry inline */}
                          {l.expiry_date && (
                            <p className={`text-xs mt-0.5 sm:hidden ${isWarn ? "text-red-400" : "text-slate-600"}`}>{isWarn && "⚠ "}{l.expiry_date}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs hidden md:table-cell">{l.category}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`font-bold text-base ${isEmpty ? "text-slate-600" : isWarn ? "text-amber-400" : "text-white"}`}>{l.qty_remaining}</span>
                          <span className="text-xs text-slate-500 ml-1">{l.unit}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-600 text-xs hidden sm:table-cell">{l.qty_original}</td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          {l.expiry_date ? (
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${isWarn ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-white/5 text-slate-400"}`}>
                              {isWarn && "⚠ "}{l.expiry_date}
                            </span>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs hidden md:table-cell">{l.supplier || "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* จ่ายออก */}
                            {!isEmpty && (
                              <button
                                onClick={() => {
                                  setDispenseLot(l);
                                  setDispenseForm({ branch_id: "", qty: l.qty_remaining.toString(), note: "" });
                                  setDispenseMsg("");
                                }}
                                title="จ่ายออกไปสาขา"
                                className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-xs font-medium transition-all flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                                <span className="hidden sm:inline">จ่ายออก</span>
                              </button>
                            )}
                            {/* ยาหาย */}
                            {!isEmpty && (
                              <button
                                onClick={() => {
                                  setLostLot(l);
                                  setLostForm({ qty: "1", note: "" });
                                  setLostMsg("");
                                }}
                                title="บันทึกยาหาย"
                                className="px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 text-xs font-medium transition-all flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                <span className="hidden sm:inline">ยาหาย</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditLot(l);
                                setEditLotMsg("");
                                setEditLotForm({
                                  qty_remaining: l.qty_remaining.toString(),
                                  expiry_date:   l.expiry_date,
                                  supplier:      l.supplier,
                                });
                              }}
                              title="แก้ไข"
                              className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-blue-500/15 hover:border-blue-500/20 hover:text-blue-400 text-xs transition-all flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              <span className="hidden sm:inline">แก้ไข</span>
                            </button>
                            <button onClick={() => { setDeleteLot(l); setDeleteMsg(""); }}
                              title="ลบ"
                              className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-600 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400 text-xs transition-all flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              <span className="hidden sm:inline">ลบ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          );
        })()}

        {/* ── Pending Requests tab ── */}
        {tab === "requests" && (() => {
          const reqBranches = Array.from(new Set(requests.map((r) => r.branch_name).filter(Boolean))).sort();

          let dispReqs = requests;
          if (reqQ) {
            const q = reqQ.toLowerCase();
            dispReqs = dispReqs.filter((r) =>
              r.product_name.toLowerCase().includes(q) ||
              r.branch_name.toLowerCase().includes(q) ||
              r.request_id.toLowerCase().includes(q)
            );
          }
          if (reqBranch) dispReqs = dispReqs.filter((r) => r.branch_name === reqBranch);
          dispReqs = [...dispReqs].sort((a, b) => {
            switch (reqSort) {
              case "date_asc":  return a.requested_at.localeCompare(b.requested_at);
              case "date_desc": return b.requested_at.localeCompare(a.requested_at);
              case "name_asc":  return a.product_name.localeCompare(b.product_name, "th");
              case "name_desc": return b.product_name.localeCompare(a.product_name, "th");
              default: return 0;
            }
          });

          return (
          <div className="space-y-3">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input type="text" value={reqQ} onChange={(e) => setReqQ(e.target.value)}
                  placeholder="ค้นหา สินค้า / สาขา / Request ID..."
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-amber-500/50 transition-all" />
              </div>
              <select value={reqBranch} onChange={(e) => setReqBranch(e.target.value)}
                className="bg-[#0d1526] border border-white/10 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500/50 transition-all min-w-[130px]"
                style={{ color: reqBranch ? "#fff" : "#475569" }}>
                <option value="">สาขาทั้งหมด</option>
                {reqBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {/* Sort pills */}
              <div className="flex gap-1">
                {(["date_desc","date_asc","name_asc","name_desc"] as ReqSort[]).map((s) => {
                  const labels: Record<ReqSort, string> = { date_desc: "ใหม่ก่อน", date_asc: "เก่าก่อน", name_asc: "A→Z", name_desc: "Z→A" };
                  return (
                    <button key={s} onClick={() => setReqSort(s)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        reqSort === s
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                      }`}>{labels[s]}</button>
                  );
                })}
              </div>
              {(reqQ || reqBranch) && (
                <button onClick={() => { setReqQ(""); setReqBranch(""); }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/15 transition-all">
                  ล้างตัวกรอง
                </button>
              )}
              <span className="text-xs text-slate-500 ml-auto">{dispReqs.length} คำขอ{dispReqs.length !== requests.length ? ` / ${requests.length}` : ""}</span>
            </div>

            {requests.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/10 rounded-[24px] px-6 py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <p className="text-slate-500">ไม่มีคำขอที่รอการอนุมัติ</p>
              </div>
            ) : dispReqs.length === 0 ? (
              <div className="bg-white/[0.04] border border-white/10 rounded-[24px] px-6 py-12 text-center">
                <p className="text-slate-500 text-sm">ไม่พบคำขอที่ตรงกับตัวกรอง</p>
              </div>
            ) : dispReqs.map((req) => (
              <div key={req.request_id} className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] p-5 relative overflow-hidden hover:bg-white/[0.06] transition-colors">
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-amber-400">{req.request_id}</span>
                      <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded-full border border-amber-500/20">PENDING</span>
                    </div>
                    <p className="text-white font-semibold text-base">{req.product_name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      <span className="text-slate-500">สาขา:</span> {req.branch_name}
                      <span className="mx-2 text-slate-600">·</span>
                      <span className="text-slate-500">ขอ:</span> <span className="text-white font-medium">{req.qty_requested} {req.unit}</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5">{req.requested_by} · {req.requested_at}</p>
                    {req.note && <p className="text-xs text-slate-500 mt-1">หมายเหตุ: {req.note}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => router.push(`/ERP/inv/purchase?productId=${encodeURIComponent(req.product_id)}&productName=${encodeURIComponent(req.product_name)}`)}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-blue-500/15 hover:border-blue-500/20 hover:text-blue-400 text-sm font-medium transition-all"
                      title="สั่งซื้อสินค้านี้">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                    </button>
                    <button onClick={() => { setEditReq(req); setEditMsg(""); setEditForm({ qty_requested: req.qty_requested.toString(), note: req.note || "" }); }}
                      className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-violet-500/15 hover:border-violet-500/20 hover:text-violet-400 text-sm font-medium transition-all"
                      title="แก้ไขคำขอ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button onClick={() => openApprove(req)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-sm font-semibold hover:opacity-90 transition-all"
                      style={{ boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
                      จัดการ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}

        {/* ── History tab ── */}
        {tab === "history" && (() => {
          const histBranches  = Array.from(new Set(historyReqs.map((r) => r.branch_name).filter(Boolean))).sort();
          const histStatuses  = Array.from(new Set(historyReqs.map((r) => r.status).filter(Boolean))).sort();

          let dispHist = historyReqs;
          if (histQ) {
            const q = histQ.toLowerCase();
            dispHist = dispHist.filter((r) =>
              r.product_name.toLowerCase().includes(q) ||
              r.branch_name.toLowerCase().includes(q) ||
              r.request_id.toLowerCase().includes(q) ||
              (r.lot_id || "").toLowerCase().includes(q)
            );
          }
          if (histBranch) dispHist = dispHist.filter((r) => r.branch_name === histBranch);
          if (histStatus) dispHist = dispHist.filter((r) => r.status.toUpperCase() === histStatus.toUpperCase());
          dispHist = [...dispHist].sort((a, b) => {
            switch (histSort) {
              case "date_asc":  return a.requested_at.localeCompare(b.requested_at);
              case "date_desc": return b.requested_at.localeCompare(a.requested_at);
              case "name_asc":  return a.product_name.localeCompare(b.product_name, "th");
              case "name_desc": return b.product_name.localeCompare(a.product_name, "th");
              default: return 0;
            }
          });

          return (
          <div className="space-y-3">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                </svg>
                <input type="text" value={histQ} onChange={(e) => setHistQ(e.target.value)}
                  placeholder="ค้นหา สินค้า / สาขา / Lot ID..."
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-white/30 transition-all" />
              </div>
              <select value={histBranch} onChange={(e) => setHistBranch(e.target.value)}
                className="bg-[#0d1526] border border-white/10 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-white/30 transition-all min-w-[130px]"
                style={{ color: histBranch ? "#fff" : "#475569" }}>
                <option value="">สาขาทั้งหมด</option>
                {histBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {/* Status chips */}
              <div className="flex gap-1">
                <button onClick={() => setHistStatus("")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    !histStatus ? "bg-white/10 border-white/20 text-white" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                  }`}>ทั้งหมด</button>
                {histStatuses.map((s) => {
                  const colors: Record<string, string> = {
                    APPROVED: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
                    REJECTED: "bg-red-500/15 border-red-500/30 text-red-300",
                    REVERSED: "bg-slate-500/15 border-slate-500/30 text-slate-300",
                  };
                  const active = histStatus.toUpperCase() === s.toUpperCase();
                  return (
                    <button key={s} onClick={() => setHistStatus(active ? "" : s)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active ? (colors[s.toUpperCase()] || "bg-white/10 border-white/20 text-white") : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                      }`}>{s}</button>
                  );
                })}
              </div>
              {/* Sort pills */}
              <div className="flex gap-1">
                {(["date_desc","date_asc","name_asc","name_desc"] as HistSort[]).map((s) => {
                  const labels: Record<HistSort, string> = { date_desc: "ใหม่ก่อน", date_asc: "เก่าก่อน", name_asc: "A→Z", name_desc: "Z→A" };
                  return (
                    <button key={s} onClick={() => setHistSort(s)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        histSort === s
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                      }`}>{labels[s]}</button>
                  );
                })}
              </div>
              {(histQ || histBranch || histStatus) && (
                <button onClick={() => { setHistQ(""); setHistBranch(""); setHistStatus(""); }}
                  className="px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-slate-300 text-xs font-medium hover:bg-white/12 transition-all">
                  ล้างตัวกรอง
                </button>
              )}
              <span className="text-xs text-slate-500 ml-auto">{dispHist.length} รายการ{dispHist.length !== historyReqs.length ? ` / ${historyReqs.length}` : ""}</span>
            </div>

            <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              {historyReqs.length === 0 ? (
                <p className="px-6 py-14 text-center text-slate-600">ยังไม่มีประวัติ</p>
              ) : dispHist.length === 0 ? (
                <p className="px-6 py-12 text-center text-slate-600 text-sm">ไม่พบรายการที่ตรงกับตัวกรอง</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <th className="px-4 py-3.5 hidden sm:table-cell">Request ID</th>
                        <th className="px-4 py-3.5">สินค้า</th>
                        <th className="px-4 py-3.5">สาขา</th>
                        <th className="px-4 py-3.5 text-right">ขอ</th>
                        <th className="px-4 py-3.5 text-right hidden sm:table-cell">อนุมัติ</th>
                        <th className="px-4 py-3.5 hidden md:table-cell">Lot</th>
                        <th className="px-4 py-3.5">สถานะ</th>
                        <th className="px-4 py-3.5 hidden sm:table-cell">วันที่</th>
                        <th className="px-4 py-3.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispHist.map((r) => (
                        <tr key={r.request_id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500 hidden sm:table-cell">{r.request_id}</td>
                          <td className="px-4 py-3.5 text-white font-medium text-sm">{r.product_name}</td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs">{r.branch_name}</td>
                          <td className="px-4 py-3.5 text-right text-slate-400">{r.qty_requested} <span className="text-slate-600 text-xs">{r.unit}</span></td>
                          <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                            {r.qty_approved
                              ? <span className="text-emerald-400 font-semibold">{r.qty_approved} <span className="text-slate-600 text-xs font-normal">{r.unit}</span></span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-600 hidden md:table-cell">{r.lot_id || "—"}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge(r.status)}`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-600 hidden sm:table-cell">{r.requested_at}</td>
                          <td className="px-5 py-3.5">
                            {r.status === "APPROVED" && (
                              <button onClick={() => { setUndoReq(r); setUndoMsg(""); }}
                                className="px-3 py-1.5 rounded-lg bg-slate-500/15 border border-slate-500/20 text-slate-400 hover:bg-orange-500/15 hover:border-orange-500/20 hover:text-orange-400 text-xs font-medium transition-all">
                                ↩ Undo
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </main>

      {/* ── Approve Modal ── */}
      {approveReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setApproveReq(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-lg p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">จัดการคำขอ</h3>
              <button onClick={() => setApproveReq(null)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">คำขอ</span><span className="text-amber-400 font-mono">{approveReq.request_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สาขา</span><span className="text-white">{approveReq.branch_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สินค้า</span><span className="text-white font-semibold">{approveReq.product_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ขอ</span><span className="text-white font-semibold">{approveReq.qty_requested} {approveReq.unit}</span></div>
            </div>

            <div className="space-y-4">

              {/* ── Lot 1: card list ── */}
              <div>
                <p className="text-xs text-slate-500 mb-2">เลือก Lot <span className="text-red-400">*</span>
                  <span className="ml-1 text-slate-600">— เรียงตามวันหมดอายุ (ก่อนก่อน)</span>
                </p>
                {availableLots.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">ไม่มี Lot ของสินค้านี้ในคลัง</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {availableLots.map((l) => {
                      const sel = approveForm.lot1_id === l.lot_id;
                      const disabled = l.lot_id === approveForm.lot2_id;
                      return (
                        <button key={l.lot_id} type="button"
                          disabled={disabled}
                          onClick={() => setApproveForm((f) => ({ ...f, lot1_id: l.lot_id, lot2_id: f.lot2_id === l.lot_id ? "" : f.lot2_id }))}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                            sel
                              ? "bg-emerald-500/15 border-emerald-500/50 text-white"
                              : disabled
                              ? "opacity-30 cursor-not-allowed bg-white/[0.02] border-white/5 text-slate-500"
                              : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07] hover:border-white/20"
                          }`}>
                          {/* Radio dot */}
                          <span className={`w-4 h-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${sel ? "border-emerald-400" : "border-slate-600"}`}>
                            {sel && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="font-mono text-xs font-semibold">{l.lot_id}</span>
                            <span className="text-slate-500 text-xs ml-2">หมด {l.expiry_date}</span>
                          </span>
                          <span className={`text-sm font-bold flex-shrink-0 ${l.qty_remaining <= 3 ? "text-red-400" : "text-emerald-400"}`}>
                            {l.qty_remaining} <span className="text-xs font-normal text-slate-500">{l.unit}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Qty 1 ── */}
              {lot1 && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 flex-shrink-0">จำนวนจาก Lot นี้</label>
                  <input type="number" min="1" max={lot1.qty_remaining}
                    value={approveForm.qty1}
                    onChange={(e) => setApproveForm((f) => ({ ...f, qty1: e.target.value }))}
                    className={`${inputCls} w-28 text-center text-base font-bold ${lot1Short ? "border-red-500/60 text-red-400" : "border-emerald-500/40"}`} />
                  <span className="text-xs text-slate-500">/ {lot1.qty_remaining} {lot1.unit} ที่มี</span>
                </div>
              )}

              {/* ── Lot 2: งอกมาเมื่อไม่พอ ── */}
              {showLot2 && (
                <div className="border-t border-white/8 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-red-500/20" />
                    <p className="text-xs text-red-400 font-semibold flex-shrink-0">
                      {lot1Short ? `Lot 1 ไม่พอ — ต้องการอีก ${spill} ${lot1?.unit} จาก Lot ที่ 2` : "Lot ที่ 2 (เสริม)"}
                    </p>
                    <div className="flex-1 h-px bg-red-500/20" />
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {availableLots.filter((l) => l.lot_id !== approveForm.lot1_id).map((l) => {
                      const sel = approveForm.lot2_id === l.lot_id;
                      return (
                        <button key={l.lot_id} type="button"
                          onClick={() => setApproveForm((f) => ({
                            ...f,
                            lot2_id: sel ? "" : l.lot_id,
                            qty2: sel ? "" : (spill > 0 ? spill.toString() : f.qty2),
                          }))}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                            sel
                              ? "bg-blue-500/15 border-blue-500/50 text-white"
                              : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07] hover:border-white/20"
                          }`}>
                          <span className={`w-4 h-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${sel ? "border-blue-400" : "border-slate-600"}`}>
                            {sel && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="font-mono text-xs font-semibold">{l.lot_id}</span>
                            <span className="text-slate-500 text-xs ml-2">หมด {l.expiry_date}</span>
                          </span>
                          <span className={`text-sm font-bold flex-shrink-0 ${l.qty_remaining <= 3 ? "text-red-400" : "text-blue-300"}`}>
                            {l.qty_remaining} <span className="text-xs font-normal text-slate-500">{l.unit}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {lot2 && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-400 flex-shrink-0">จำนวนจาก Lot ที่ 2</label>
                      <input type="number" min="1" max={lot2.qty_remaining}
                        value={approveForm.qty2}
                        onChange={(e) => setApproveForm((f) => ({ ...f, qty2: e.target.value }))}
                        className={`${inputCls} w-28 text-center text-base font-bold ${lot2Short ? "border-red-500/60 text-red-400" : "border-blue-500/40"}`} />
                      <span className="text-xs text-slate-500">/ {lot2.qty_remaining} {lot2.unit} ที่มี</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Summary ── */}
              {qty1Num > 0 && !lot1Short && (
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-semibold ${
                  totalApproved === approveReq.qty_requested
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-300"
                }`}>
                  <span>รวม <b>{totalApproved}</b> {approveReq.unit}</span>
                  <span className="text-xs font-normal opacity-70">
                    {totalApproved === approveReq.qty_requested ? "✓ ตรงกับที่ขอ" : `ขอ ${approveReq.qty_requested} ${approveReq.unit}`}
                  </span>
                </div>
              )}

              {/* ── Note ── */}
              <input type="text" value={approveForm.note}
                onChange={(e) => setApproveForm({ ...approveForm, note: e.target.value })}
                placeholder="หมายเหตุ (ถ้ามี)"
                className={inputCls} />
            </div>

            {approveMsg && (
              <p className={`mt-3 text-sm px-4 py-2.5 rounded-xl border ${
                approveMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{approveMsg}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => handleApprove("approve")}
                disabled={approving || !canApprove}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  canApprove
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:opacity-90"
                    : "bg-white/5 border border-white/10 text-slate-600 cursor-not-allowed"
                }`}>
                {approving ? "กำลังดำเนินการ..." : canApprove ? `✓ อนุมัติ ${totalApproved} ${approveReq.unit}` : "เลือก Lot และจำนวนก่อน"}
              </button>
              <button onClick={() => handleApprove("reject")} disabled={approving}
                className="flex-1 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/25 disabled:opacity-40 transition-all">
                ✕ ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Lot Modal ── */}
      {editLot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !editLotSaving) setEditLot(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold">แก้ไข Lot</h3>
                <p className="text-blue-400 font-mono text-xs mt-0.5">{editLot.lot_id}</p>
              </div>
              <button onClick={() => setEditLot(null)} disabled={editLotSaving}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-5 text-sm">
              <p className="text-white font-semibold">{editLot.product_name}</p>
              <p className="text-slate-500 text-xs mt-0.5">{editLot.brand || editLot.category || ""}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">จำนวนคงเหลือ ({editLot.unit})</label>
                <input type="number" min="0"
                  value={editLotForm.qty_remaining}
                  onChange={(e) => setEditLotForm({ ...editLotForm, qty_remaining: e.target.value })}
                  className={inputCls} />
                <p className="text-xs text-slate-600 mt-1">ค่าเดิม: {editLot.qty_remaining} / {editLot.qty_original} {editLot.unit}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">วันหมดอายุ</label>
                <input type="date"
                  value={editLotForm.expiry_date}
                  onChange={(e) => setEditLotForm({ ...editLotForm, expiry_date: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">Supplier</label>
                <input type="text"
                  value={editLotForm.supplier}
                  onChange={(e) => setEditLotForm({ ...editLotForm, supplier: e.target.value })}
                  placeholder="ชื่อ Supplier"
                  className={inputCls} />
              </div>
            </div>

            {editLotMsg && (
              <p className={`mt-4 text-sm px-4 py-2.5 rounded-xl border ${
                editLotMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{editLotMsg}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditLot(null)} disabled={editLotSaving}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleEditLotSave} disabled={editLotSaving}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {editLotSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Lot Modal ── */}
      {deleteLot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteLot(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">ยืนยันลบ Lot</h3>
                <p className="text-slate-500 text-xs">Super Admin เท่านั้น — ลบถาวร</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Lot ID</span><span className="text-red-400 font-mono">{deleteLot.lot_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สินค้า</span><span className="text-white font-semibold">{deleteLot.product_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">คงเหลือ</span><span className={`font-bold ${deleteLot.qty_remaining > 0 ? "text-amber-400" : "text-slate-400"}`}>{deleteLot.qty_remaining} / {deleteLot.qty_original} {deleteLot.unit}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">หมดอายุ</span><span className="text-slate-300">{deleteLot.expiry_date || "—"}</span></div>
            </div>

            {deleteLot.qty_remaining > 0 && deleteLot.qty_remaining < deleteLot.qty_original && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-amber-400 text-xs">⚠ Lot นี้มีของโอนออกไปสาขาบางส่วนแล้ว ({deleteLot.qty_original - deleteLot.qty_remaining} {deleteLot.unit}) — การลบจะไม่กระทบสต๊อคที่สาขาได้รับไปแล้ว</p>
              </div>
            )}
            {deleteLot.qty_remaining === deleteLot.qty_original && deleteLot.qty_remaining > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-red-400 text-xs">⚠ Lot ยังมีสินค้าคงเหลืออยู่ {deleteLot.qty_remaining} {deleteLot.unit} — การลบจะทำให้ของหายออกจากระบบ</p>
              </div>
            )}

            {deleteMsg && (
              <p className={`mb-4 text-sm px-4 py-2.5 rounded-xl border ${
                deleteMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{deleteMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDeleteLot(null)} disabled={deleting}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleDeleteLot} disabled={deleting}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {deleting ? "กำลังลบ..." : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Request Modal ── */}
      {editReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !editSaving) setEditReq(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold">แก้ไขคำขอ</h3>
                <p className="text-violet-400 font-mono text-xs mt-0.5">{editReq.request_id}</p>
              </div>
              <button onClick={() => setEditReq(null)} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">สาขา</span><span className="text-white">{editReq.branch_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สินค้า</span><span className="text-white font-semibold">{editReq.product_name}</span></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">จำนวนที่ขอ ({editReq.unit})</label>
                <input type="number" min="1" value={editForm.qty_requested}
                  onChange={(e) => setEditForm({ ...editForm, qty_requested: e.target.value })}
                  className={inputCls} />
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
              <button onClick={() => setEditReq(null)} disabled={editSaving}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleEditReqSave} disabled={editSaving}
                className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {editSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo Confirmation Modal ── */}
      {undoReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !undoing) setUndoReq(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold">ยืนยัน Undo การโอน</h3>
                <p className="text-slate-500 text-xs">Super Admin เท่านั้น</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">คำขอ</span><span className="text-slate-300 font-mono">{undoReq.request_id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สาขา</span><span className="text-white">{undoReq.branch_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">สินค้า</span><span className="text-white font-semibold">{undoReq.product_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Lot</span><span className="text-slate-300 font-mono text-xs">{undoReq.lot_id || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">จำนวนที่โอน</span><span className="text-orange-400 font-bold">{undoReq.qty_approved} {undoReq.unit}</span></div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 mb-5">
              <p className="text-orange-400 text-xs leading-relaxed">
                การ Undo จะ: <span className="font-semibold">คืน {undoReq.qty_approved} {undoReq.unit}</span> กลับ Lot ในคลังกลาง
                และ <span className="font-semibold">ล้างสต๊อคสาขา</span> สำหรับ Transfer นี้
                <br />
                <span className="text-orange-400/70">หากสาขาใช้สินค้าไปแล้วบางส่วน ระบบจะแจ้งเตือนแต่ยังคืนจำนวนเต็ม</span>
              </p>
            </div>

            {undoMsg && (
              <p className={`mb-4 text-sm px-4 py-2.5 rounded-xl border ${
                undoMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{undoMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setUndoReq(null)} disabled={undoing}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleUndo} disabled={undoing}
                className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {undoing ? "กำลัง Undo..." : "↩ ยืนยัน Undo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOST MODAL (ยาหาย) ═══════════════════════════════════════════════ */}
      {lostLot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !lostSaving) setLostLot(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  บันทึกยาหาย
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">ตัดสต๊อคออกจากคลังกลาง + บันทึก log</p>
              </div>
              <button onClick={() => setLostLot(null)} disabled={lostSaving}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Lot summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Lot</span>
                <span className="font-mono text-emerald-400">{lostLot.lot_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">สินค้า</span>
                <span className="text-white font-semibold">{lostLot.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">คงเหลือ</span>
                <span className="text-white font-bold">{lostLot.qty_remaining} {lostLot.unit}</span>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
                  จำนวนที่หาย ({lostLot.unit}) * <span className="text-slate-600 font-normal normal-case">สูงสุด {lostLot.qty_remaining}</span>
                </label>
                <input
                  type="number" min="1" max={lostLot.qty_remaining}
                  value={lostForm.qty}
                  onChange={(e) => setLostForm({ ...lostForm, qty: e.target.value })}
                  className={inputCls}
                />
                {Number(lostForm.qty) > lostLot.qty_remaining && (
                  <p className="text-red-400 text-xs mt-1">❌ เกินจำนวนที่มีใน Lot</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">สาเหตุ / หมายเหตุ *</label>
                <input
                  type="text"
                  value={lostForm.note}
                  onChange={(e) => setLostForm({ ...lostForm, note: e.target.value })}
                  placeholder="เช่น ของหายระหว่างขนส่ง, นับสต๊อคไม่ตรง..."
                  className={inputCls}
                />
              </div>
            </div>

            {lostMsg && (
              <p className={`mb-4 text-sm px-4 py-2.5 rounded-xl border ${
                lostMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{lostMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setLostLot(null)} disabled={lostSaving}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button
                onClick={handleLost}
                disabled={lostSaving || !lostForm.qty || Number(lostForm.qty) <= 0 || Number(lostForm.qty) > lostLot.qty_remaining || !lostForm.note.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all">
                {lostSaving ? "กำลังบันทึก..." : "⚠ ยืนยันยาหาย"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DISPENSE MODAL ════════════════════════════════════════════════════ */}
      {dispenseLot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !dispensing) setDispenseLot(null); }}>
          <div className="bg-[#0d1526] border border-white/10 rounded-[28px] w-full max-w-md p-6 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-white font-bold">จ่ายออกสู่สาขา</h3>
                <p className="text-slate-500 text-xs mt-0.5">จ่ายตรงโดยไม่ต้องรอ Request</p>
              </div>
              <button onClick={() => setDispenseLot(null)} disabled={dispensing}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Lot summary */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Lot</span>
                <span className="font-mono text-emerald-400">{dispenseLot.lot_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">สินค้า</span>
                <span className="text-white font-semibold">{dispenseLot.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">คงเหลือ</span>
                <span className="text-white font-bold">{dispenseLot.qty_remaining} {dispenseLot.unit}</span>
              </div>
              {dispenseLot.expiry_date && (
                <div className="flex justify-between">
                  <span className="text-slate-500">หมดอายุ</span>
                  <span className="text-slate-300">{dispenseLot.expiry_date}</span>
                </div>
              )}
            </div>

            <div className="space-y-4 mb-5">
              {/* Branch select */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">สาขาปลายทาง *</label>
                <select
                  value={dispenseForm.branch_id}
                  onChange={(e) => setDispenseForm({ ...dispenseForm, branch_id: e.target.value })}
                  className={`${selectCls} ${!dispenseForm.branch_id ? "text-slate-600" : ""}`}>
                  <option value="">— เลือกสาขา —</option>
                  {branches.map((b) => (
                    <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              {/* Qty */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">
                  จำนวน ({dispenseLot.unit}) * <span className="text-slate-600 font-normal normal-case">สูงสุด {dispenseLot.qty_remaining}</span>
                </label>
                <input
                  type="number" min="1" max={dispenseLot.qty_remaining}
                  value={dispenseForm.qty}
                  onChange={(e) => setDispenseForm({ ...dispenseForm, qty: e.target.value })}
                  className={inputCls}
                />
                {Number(dispenseForm.qty) > dispenseLot.qty_remaining && (
                  <p className="text-red-400 text-xs mt-1">❌ เกินจำนวนที่มีใน Lot</p>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 block">หมายเหตุ</label>
                <input
                  type="text"
                  value={dispenseForm.note}
                  onChange={(e) => setDispenseForm({ ...dispenseForm, note: e.target.value })}
                  placeholder="หมายเหตุ (ถ้ามี)"
                  className={inputCls}
                />
              </div>
            </div>

            {dispenseMsg && (
              <p className={`mb-4 text-sm px-4 py-2.5 rounded-xl border ${
                dispenseMsg.startsWith("✓") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>{dispenseMsg}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setDispenseLot(null)} disabled={dispensing}
                className="flex-1 py-2.5 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/10 disabled:opacity-40 transition-all">
                ยกเลิก
              </button>
              <button
                onClick={handleDispense}
                disabled={dispensing || !dispenseForm.branch_id || !dispenseForm.qty || Number(dispenseForm.qty) <= 0 || Number(dispenseForm.qty) > dispenseLot.qty_remaining}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                style={{ boxShadow: "0 4px 16px rgba(16,185,129,0.25)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                {dispensing ? "กำลังจ่าย..." : "ยืนยันจ่ายออก"}
              </button>
            </div>
          </div>
        </div>
      )}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}
