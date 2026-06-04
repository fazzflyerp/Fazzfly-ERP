"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface StockItem {
  stock_id: string; product_name: string; category: string; brand: string;
  unit: string; lot_id: string; qty_received: number; qty_remaining: number;
  expiry_date: string; transfer_id: string; received_at: string;
  cost_per_unit: number;
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
interface BranchLog {
  log_id: string; log_date: string; action_type: string;
  product_name: string; lot_id: string; stock_id: string;
  qty: number; context: string; note: string; recorded_by: string;
}
type HistoryFilter = "all" | "USAGE" | "LOST" | "TRANSFER" | "RETURN_CENTRAL" | "EXPIRED";

interface DispenseConfig {
  config_id: string; product_id: string; product_name: string;
  dispense_unit: string; units_per_stock: number; open_expiry_days: number | null; notes: string;
}
interface ProtocolIngredient {
  product_id: string; product_name: string; qty: number; unit: string; sort: number;
  // runtime edit
  qty_edit?: number;
  // conversion extras (loaded when ingredient has a config)
  dispense_unit?: string; units_per_stock?: number; open_expiry_days?: number | null;
  use_conversion?: boolean;
}
interface Protocol {
  protocol_id: string; protocol_name: string;
  ingredients: ProtocolIngredient[];
}

type ModalMode = "request" | "usage" | "edit" | "delete" | "deleteUsage" | "lost" | "transferBranch" | "returnCentral" | null;
type UsageMode = "direct" | "conversion" | "protocol";
type SettingsTab = "dispense" | "protocol";

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
  const [logs, setLogs]                 = useState<BranchLog[]>([]);
  const [logsLoading, setLogsLoading]   = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [expiredAlert, setExpiredAlert] = useState<{ product_name: string; qty: number }[]>([]);

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

  // ยาหาย
  const [lostItem, setLostItem]         = useState<StockItem | null>(null);
  const [lostQty, setLostQty]           = useState("");
  const [lostNote, setLostNote]         = useState("");

  // ส่งยาข้ามสาขา (SA only)
  const [transferItem, setTransferItem]       = useState<StockItem | null>(null);
  const [transferQty, setTransferQty]         = useState("");
  const [transferNote, setTransferNote]       = useState("");
  const [transferToBranch, setTransferToBranch] = useState("");

  // ส่งคืนคลังกลาง (SA only)
  const [returnItem, setReturnItem]     = useState<StockItem | null>(null);
  const [returnQty, setReturnQty]       = useState("");
  const [returnNote, setReturnNote]     = useState("");

  // ── Settings modal (SA only) ─────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab]   = useState<SettingsTab>("dispense");

  // Dispense config
  const [dispenseConfigs, setDispenseConfigs] = useState<DispenseConfig[]>([]);
  const [dcLoading, setDcLoading]             = useState(false);
  const [dcSubmitting, setDcSubmitting]       = useState(false);
  const [dcError, setDcError]                 = useState("");
  const [dcEditId, setDcEditId]               = useState<string | null>(null);
  const [dcForm, setDcForm]                   = useState({ product_id: "", product_name: "", dispense_unit: "", units_per_stock: "", open_expiry_days: "", notes: "" });

  // Protocol manager
  const [protocols, setProtocols]       = useState<Protocol[]>([]);
  const [ptLoading, setPtLoading]       = useState(false);
  const [ptSubmitting, setPtSubmitting] = useState(false);
  const [ptError, setPtError]           = useState("");
  const [ptEditId, setPtEditId]         = useState<string | null>(null);
  const [ptForm, setPtForm]             = useState({ protocol_name: "" });
  const [ptIngredients, setPtIngredients] = useState<{ product_id: string; product_name: string; qty: string; unit: string }[]>([{ product_id: "", product_name: "", qty: "1", unit: "" }]);

  // ── Usage mode ───────────────────────────────────────────────────────────
  const [usageMode, setUsageMode]                 = useState<UsageMode>("direct");
  const [convProduct, setConvProduct]             = useState<AvailableProduct | null>(null);
  const [convConfig, setConvConfig]               = useState<DispenseConfig | null>(null);
  const [convQty, setConvQty]                     = useState("");
  const [selectedProtocol, setSelectedProtocol]   = useState("");
  const [protoIngredients, setProtoIngredients]   = useState<ProtocolIngredient[]>([]);

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

  const loadLogs = useCallback(async (branchId?: string) => {
    setLogsLoading(true);
    try {
      const qp = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
      const d  = await fetch(`/api/inv/branch-log${qp}`).then((r) => r.json());
      setLogs(d.logs || []);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, []);

  /** ตรวจสอบและตัดยาหมดอายุอัตโนมัติ — เรียกก่อน loadStock ทุกครั้ง */
  async function runExpireSweep(branchId?: string) {
    try {
      const body = branchId ? { branch_id: branchId } : {};
      const d = await fetch("/api/inv/expire-sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (d.swept > 0) setExpiredAlert(d.items || []);
    } catch { /* ไม่ block flow หลัก */ }
  }

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

  async function loadDispenseConfigs() {
    setDcLoading(true);
    try {
      const d = await fetch("/api/inv/dispense-config").then((r) => r.json());
      setDispenseConfigs(d.configs || []);
    } catch { setDispenseConfigs([]); }
    finally { setDcLoading(false); }
  }
  async function loadProtocols() {
    setPtLoading(true);
    try {
      const d = await fetch("/api/inv/protocols").then((r) => r.json());
      setProtocols(d.protocols || []);
    } catch { setProtocols([]); }
    finally { setPtLoading(false); }
  }

  function openSettings() {
    setSettingsOpen(true); setSettingsTab("dispense"); setDcError(""); setPtError("");
    setDcEditId(null); setPtEditId(null);
    setDcForm({ product_id: "", product_name: "", dispense_unit: "", units_per_stock: "", open_expiry_days: "", notes: "" });
    setPtForm({ protocol_name: "" });
    setPtIngredients([{ product_id: "", product_name: "", qty: "1", unit: "" }]);
    loadDispenseConfigs();
    loadProtocols();
    // โหลด product list สำหรับ dropdown
    fetch("/api/inv/products").then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => {});
  }

  // ── Dispense Config CRUD ──────────────────────────────────────────────────
  function startDcEdit(cfg: DispenseConfig) {
    setDcEditId(cfg.config_id);
    setDcForm({
      product_id: cfg.product_id, product_name: cfg.product_name,
      dispense_unit: cfg.dispense_unit, units_per_stock: String(cfg.units_per_stock),
      open_expiry_days: cfg.open_expiry_days != null ? String(cfg.open_expiry_days) : "",
      notes: cfg.notes,
    });
  }
  async function handleDcSave() {
    if (!dcForm.product_id || !dcForm.dispense_unit || !dcForm.units_per_stock) {
      setDcError("product_id, dispense_unit, units_per_stock ต้องมีค่า"); return;
    }
    setDcSubmitting(true); setDcError("");
    try {
      const payload = {
        product_id: dcForm.product_id, product_name: dcForm.product_name,
        dispense_unit: dcForm.dispense_unit, units_per_stock: Number(dcForm.units_per_stock),
        open_expiry_days: dcForm.open_expiry_days !== "" ? Number(dcForm.open_expiry_days) : null,
        notes: dcForm.notes,
      };
      if (dcEditId) {
        const res = await fetch("/api/inv/dispense-config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config_id: dcEditId, ...payload }) }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
      } else {
        const res = await fetch("/api/inv/dispense-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
      }
      setDcEditId(null);
      setDcForm({ product_id: "", product_name: "", dispense_unit: "", units_per_stock: "", open_expiry_days: "", notes: "" });
      await loadDispenseConfigs();
    } catch (e: any) { setDcError(e.message); }
    finally { setDcSubmitting(false); }
  }
  async function handleDcDelete(config_id: string) {
    if (!confirm("ลบ config นี้?")) return;
    try {
      await fetch("/api/inv/dispense-config", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config_id }) });
      await loadDispenseConfigs();
    } catch { /* ignore */ }
  }

  // ── Protocol CRUD ─────────────────────────────────────────────────────────
  function startPtEdit(p: Protocol) {
    setPtEditId(p.protocol_id);
    setPtForm({ protocol_name: p.protocol_name });
    setPtIngredients(p.ingredients.map((ing) => ({
      product_id: ing.product_id, product_name: ing.product_name,
      qty: String(ing.qty), unit: ing.unit,
    })));
  }
  async function handlePtSave() {
    if (!ptForm.protocol_name || ptIngredients.some((i) => !i.product_id || !i.unit || !i.qty)) {
      setPtError("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    setPtSubmitting(true); setPtError("");
    try {
      const ings = ptIngredients.map((i) => ({ product_id: i.product_id, product_name: i.product_name, qty: Number(i.qty), unit: i.unit }));
      if (ptEditId) {
        const res = await fetch("/api/inv/protocols", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocol_id: ptEditId, protocol_name: ptForm.protocol_name, ingredients: ings }) }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
      } else {
        const res = await fetch("/api/inv/protocols", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocol_name: ptForm.protocol_name, ingredients: ings }) }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
      }
      setPtEditId(null);
      setPtForm({ protocol_name: "" });
      setPtIngredients([{ product_id: "", product_name: "", qty: "1", unit: "" }]);
      await loadProtocols();
    } catch (e: any) { setPtError(e.message); }
    finally { setPtSubmitting(false); }
  }
  async function handlePtDelete(protocol_id: string) {
    if (!confirm("ลบ protocol นี้?")) return;
    try {
      await fetch("/api/inv/protocols", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ protocol_id }) });
      await loadProtocols();
    } catch { /* ignore */ }
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
            await runExpireSweep(list[0].branchId);
            await Promise.all([loadStock(list[0].branchId), loadUsages(list[0].branchId), loadLogs(list[0].branchId)]);
          } else { setStockLoading(false); }
        } else {
          await runExpireSweep();
          await Promise.all([loadStock(), loadUsages(), loadLogs()]);
        }
      } catch (e: any) { setStockError(e.message); setStockLoading(false); }
    }
    init();
  }, [loadStock, loadUsages, loadLogs]);

  async function handleBranchChange(bid: string) {
    setSelectedBranch(bid); setStock([]); setUsages([]); setLogs([]); setExpiredAlert([]);
    await runExpireSweep(bid);
    await Promise.all([loadStock(bid), loadUsages(bid), loadLogs(bid)]);
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
    setUsageMode("direct"); setConvProduct(null); setConvConfig(null); setConvQty("");
    setSelectedProtocol(""); setProtoIngredients([]);
    setModal("usage");
    const bp = effectiveBid ? `&branchId=${encodeURIComponent(effectiveBid)}` : "";
    const qp = effectiveBid ? `?branchId=${encodeURIComponent(effectiveBid)}` : "";
    const [pd, dd, dc, pr] = await Promise.all([
      fetch(`/api/inv/usage?available=true${bp}`).then((r) => r.json()),
      fetch(`/api/inv/doctors${qp}`).then((r) => r.json()),
      fetch("/api/inv/dispense-config").then((r) => r.json()),
      fetch("/api/inv/protocols").then((r) => r.json()),
    ]);
    setAvailProducts(pd.products || []);
    setDoctors(dd.doctors || []);
    setDispenseConfigs(dc.configs || []);
    setProtocols(pr.protocols || []);
  }

  async function handleUsage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true); setModalError("");
    try {
      let body: any = { doctor: useForm.doctor, note: useForm.note };
      if (effectiveBid) body.branch_id = effectiveBid;

      if (usageMode === "direct") {
        const sel = availProducts.find((p) => p.product_id.toString() === useForm.product_id);
        if (!sel || Number(useForm.qty_used) <= 0) { setModalError("กรุณาเลือกสินค้าและระบุจำนวน"); setSubmitting(false); return; }
        body = { ...body, mode: "direct", product_id: sel.product_id, product_name: sel.product_name, category: sel.category, unit: sel.unit, qty_used: Number(useForm.qty_used) };

      } else if (usageMode === "conversion") {
        if (!convProduct || !convConfig || Number(convQty) <= 0) { setModalError("กรุณาเลือกสินค้าและระบุจำนวน"); setSubmitting(false); return; }
        body = {
          ...body, mode: "conversion",
          product_id: convProduct.product_id, product_name: convProduct.product_name,
          category: convProduct.category,
          dispense_unit: convConfig.dispense_unit,
          units_per_stock: convConfig.units_per_stock,
          open_expiry_days: convConfig.open_expiry_days,
          qty_dispense: Number(convQty),
        };

      } else if (usageMode === "protocol") {
        if (!selectedProtocol || protoIngredients.length === 0) { setModalError("กรุณาเลือก Protocol"); setSubmitting(false); return; }
        body = {
          ...body, mode: "protocol", protocol_id: selectedProtocol,
          ingredients: protoIngredients.map((ing) => ({
            product_id: ing.product_id, product_name: ing.product_name,
            qty_used: ing.qty_edit ?? ing.qty,
            unit: ing.dispense_unit || ing.unit,
            ...(ing.use_conversion && ing.units_per_stock ? {
              mode: "conversion",
              dispense_unit: ing.dispense_unit || ing.unit,
              units_per_stock: ing.units_per_stock,
              open_expiry_days: ing.open_expiry_days ?? null,
            } : {}),
          })),
        };
      }

      const res  = await fetch("/api/inv/record-usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const successMsg = data.mode === "protocol"
        ? `✓ บันทึก ${data.results?.length || 0} รายการสำเร็จ`
        : `✓ บันทึกสำเร็จ · ${data.usage_id}`;
      setModalSuccess(successMsg);
      setUseForm({ product_id: "", qty_used: "", doctor: "", note: "" });
      setConvProduct(null); setConvConfig(null); setConvQty(""); setSelectedProtocol(""); setProtoIngredients([]);
      await Promise.all([loadStock(effectiveBid || undefined), loadUsages(effectiveBid || undefined), refreshAvailProducts(effectiveBid || undefined)]);
      loadLogs(effectiveBid || undefined);
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

  // ── ยาหาย ──────────────────────────────────────────────────────────────────
  function openLost(item: StockItem) {
    setLostItem(item); setLostQty(""); setLostNote(""); setModalError(""); setModalSuccess("");
    setModal("lost");
  }
  async function handleLost() {
    if (!lostItem || Number(lostQty) <= 0) { setModalError("กรุณาระบุจำนวนที่หาย"); return; }
    if (Number(lostQty) > lostItem.qty_remaining) { setModalError(`จำนวนเกินกว่าสต๊อค (${lostItem.qty_remaining})`); return; }
    setSubmitting(true); setModalError("");
    try {
      const body: any = { stock_id: lostItem.stock_id, qty_lost: Number(lostQty), note: lostNote };
      if (effectiveBid) body.branch_id = effectiveBid;
      const res = await fetch("/api/inv/lost", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setModalSuccess(`✓ บันทึกยาหาย ${lostQty} ${lostItem.unit} สำเร็จ (${res.lost_id})`);
      setStock((prev) => prev.map((s) => s.stock_id === lostItem.stock_id ? { ...s, qty_remaining: res.new_qty } : s));
      loadLogs(effectiveBid || undefined);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── ส่งยาข้ามสาขา ─────────────────────────────────────────────────────────
  function openTransferBranch(item: StockItem) {
    setTransferItem(item); setTransferQty(""); setTransferNote(""); setTransferToBranch(""); setModalError(""); setModalSuccess("");
    setModal("transferBranch");
  }
  async function handleTransferBranch() {
    if (!transferItem || Number(transferQty) <= 0 || !transferToBranch) { setModalError("กรุณาระบุสาขาปลายทางและจำนวน"); return; }
    if (Number(transferQty) > transferItem.qty_remaining) { setModalError(`จำนวนเกินกว่าสต๊อค (${transferItem.qty_remaining})`); return; }
    setSubmitting(true); setModalError("");
    try {
      const res = await fetch("/api/inv/transfer-branch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_id: transferItem.stock_id,
          qty: Number(transferQty),
          from_branch_id: effectiveBid,
          to_branch_id: transferToBranch,
          note: transferNote,
        }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      const toBranchName = branches.find((b) => b.branchId === transferToBranch)?.branchName || transferToBranch;
      setModalSuccess(`✓ โอน ${transferQty} ${transferItem.unit} ไปสาขา ${toBranchName} สำเร็จ`);
      const moved = Number(transferQty);
      setStock((prev) => prev.map((s) => s.stock_id === transferItem.stock_id ? { ...s, qty_remaining: s.qty_remaining - moved } : s));
      loadLogs(effectiveBid || undefined);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── ส่งคืนคลังกลาง ────────────────────────────────────────────────────────
  function openReturnCentral(item: StockItem) {
    setReturnItem(item); setReturnQty(""); setReturnNote(""); setModalError(""); setModalSuccess("");
    setModal("returnCentral");
  }
  async function handleReturnCentral() {
    if (!returnItem || Number(returnQty) <= 0) { setModalError("กรุณาระบุจำนวนที่ส่งคืน"); return; }
    if (Number(returnQty) > returnItem.qty_remaining) { setModalError(`จำนวนเกินกว่าสต๊อค (${returnItem.qty_remaining})`); return; }
    setSubmitting(true); setModalError("");
    try {
      const body: any = { stock_id: returnItem.stock_id, qty_return: Number(returnQty), note: returnNote };
      if (effectiveBid) body.branch_id = effectiveBid;
      const res = await fetch("/api/inv/return-central", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setModalSuccess(`✓ ส่งคืนคลังกลาง ${returnQty} ${returnItem.unit} สำเร็จ`);
      const returned = Number(returnQty);
      setStock((prev) => prev.map((s) => s.stock_id === returnItem.stock_id ? { ...s, qty_remaining: s.qty_remaining - returned } : s));
      loadLogs(effectiveBid || undefined);
    } catch (e: any) { setModalError(e.message); }
    finally { setSubmitting(false); }
  }

  function closeModal() { if (submitting || deleting) return; setModal(null); setModalError(""); setModalSuccess(""); }

  // ── Derived ────────────────────────────────────────────────────────────────
  const today  = new Date();
  const warn30 = new Date(today); warn30.setDate(today.getDate() + 30);
  const withStock   = stock.filter((s) => s.qty_remaining > 0).length;
  const nearExpiry  = stock.filter((s) => { const e = s.expiry_date ? new Date(s.expiry_date) : null; return e && e <= warn30 && s.qty_remaining > 0; }).length;
  const totalValue  = stock.reduce((sum, s) => sum + (s.qty_remaining * (s.cost_per_unit || 0)), 0);
  const selProduct  = availProducts.find((p) => p.product_id.toString() === useForm.product_id);

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
          {isSA && (
            <button onClick={openSettings} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-500/10 border border-slate-500/20 text-slate-400 hover:bg-slate-500/20 transition-all" title="ตั้งค่าหน่วย / Protocol">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              ตั้งค่า
            </button>
          )}
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
            { key: "history", label: "ประวัติกิจกรรม" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-all ${tab === key ? "text-white bg-white/[0.06] border border-b-0 border-white/10" : "text-slate-500 hover:text-slate-300"}`}>
              {label}
              {key === "history" && (usages.length + logs.length) > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs">{usages.length + logs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-6">

        {/* ── Tab: สต๊อค ─────────────────────────────────────────────────── */}
        {/* Expired alert banner */}
        {expiredAlert.length > 0 && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-rose-400 font-semibold text-sm">พบ {expiredAlert.length} รายการหมดอายุ — ระบบตัด qty ออกจากสต๊อคแล้ว</p>
              <ul className="mt-1.5 space-y-0.5">
                {expiredAlert.map((item, i) => (
                  <li key={i} className="text-xs text-rose-300/80">
                    • {item.product_name} <span className="text-rose-400 font-medium">({item.qty} หน่วย)</span>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => setExpiredAlert([])} className="text-rose-400/60 hover:text-rose-400 transition-colors mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {tab === "stock" && (
          <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
            <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/5">
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
              <div className="px-6 py-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">มูลค่าสต๊อค</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">
                  {totalValue > 0
                    ? `฿${totalValue.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : <span className="text-slate-600">—</span>}
                </p>
              </div>
            </div>
            {stockError && (
              <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{stockError}</div>
            )}
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
                      <th className="px-5 py-3.5 text-right">มูลค่า</th>
                      <th className="px-5 py-3.5 text-right">รับมา</th>
                      <th className="px-5 py-3.5">Lot</th>
                      <th className="px-5 py-3.5">หมดอายุ</th>
                      <th className="px-5 py-3.5">รับเมื่อ</th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {stock.length === 0 ? (
                      <tr><td colSpan={10} className="px-5 py-14 text-center">
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
                          <td className="px-5 py-3.5 text-right">
                            {s.cost_per_unit > 0 && s.qty_remaining > 0 ? (
                              <span className="text-amber-400 font-medium text-sm">
                                ฿{(s.qty_remaining * s.cost_per_unit).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            ) : <span className="text-slate-700 text-xs">—</span>}
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
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 justify-end flex-wrap">
                              {isSA && <button onClick={() => openEdit(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all">แก้ไข</button>}
                              {isSA && <button onClick={() => openDelete(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">ลบ</button>}
                              <button onClick={() => openLost(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all">ยาหาย</button>
                              {isSA && <button onClick={() => openTransferBranch(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition-all">ส่งข้าม</button>}
                              {isSA && <button onClick={() => openReturnCentral(s)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 transition-all">ส่งคืน</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: ประวัติกิจกรรม ─────────────────────────────────────────── */}
        {tab === "history" && (() => {
          // ── Build unified history ──────────────────────────────────────────
          type HRec = {
            id: string; date: string; type: string;
            product_name: string; qty: number; unit: string;
            context: string; note: string; by: string;
            // usage-specific
            cost_per_unit?: number; cost_total?: number; lot_id?: string;
            // raw usage ref for delete
            usageRef?: UsageRecord;
          };

          function parseThaiDate(s: string): number {
            const m = s.match(/(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+)/);
            if (!m) return 0;
            return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime();
          }

          const usageRecs: HRec[] = usages.map((u) => ({
            id: u.usage_id, date: u.used_at, type: "USAGE",
            product_name: u.product_name, qty: u.qty_used, unit: u.unit,
            context: u.doctor || "—", note: u.note, by: u.used_by,
            cost_per_unit: u.cost_per_unit, cost_total: u.cost_total, lot_id: u.lot_id,
            usageRef: u,
          }));
          const logRecs: HRec[] = logs.map((l) => ({
            id: l.log_id, date: l.log_date, type: l.action_type,
            product_name: l.product_name, qty: l.qty, unit: "",
            context: l.context, note: l.note, by: l.recorded_by,
            lot_id: l.lot_id,
          }));
          const allRecs = [...usageRecs, ...logRecs].sort((a, b) => parseThaiDate(b.date) - parseThaiDate(a.date));

          const filtered = allRecs.filter((r) => {
            if (historyFilter === "all") return true;
            if (historyFilter === "TRANSFER") return r.type === "TRANSFER_OUT" || r.type === "TRANSFER_IN";
            return r.type === historyFilter;
          });

          // count helper for filter tabs
          const countFor = (key: HistoryFilter) => {
            if (key === "all") return allRecs.length;
            if (key === "TRANSFER") return allRecs.filter((r) => r.type === "TRANSFER_OUT" || r.type === "TRANSFER_IN").length;
            return allRecs.filter((r) => r.type === key).length;
          };

          const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
            USAGE:           { label: "บันทึกการใช้", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
            LOST:            { label: "ยาหาย",        color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
            TRANSFER_OUT:    { label: "ส่งออกสาขา",   color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20"    },
            TRANSFER_IN:     { label: "รับจากสาขา",   color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
            RETURN_CENTRAL:  { label: "ส่งคืนคลัง",   color: "text-teal-400",   bg: "bg-teal-500/10",   border: "border-teal-500/20"   },
            EXPIRED:         { label: "หมดอายุ",       color: "text-rose-400",   bg: "bg-rose-500/10",   border: "border-rose-500/20"   },
          };

          const FILTER_TABS: { key: HistoryFilter; label: string }[] = [
            { key: "all",            label: "ทั้งหมด"       },
            { key: "USAGE",          label: "บันทึกการใช้"  },
            { key: "LOST",           label: "ยาหาย"         },
            { key: "EXPIRED",        label: "หมดอายุ"       },
            { key: "TRANSFER",       label: "ส่งข้ามสาขา"  },
            { key: "RETURN_CENTRAL", label: "ส่งคืนคลัง"   },
          ];

          const isLoading = usageLoading || logsLoading;
          const totalCostFiltered = filtered.reduce((s, r) => s + (r.cost_total || 0), 0);

          return (
            <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden relative">
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />

              {/* Header + filter chips */}
              <div className="px-6 py-4 border-b border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold">ประวัติกิจกรรม</h2>
                  <div className="flex items-center gap-3">
                    {totalCostFiltered > 0 && (
                      <span className="text-sm text-amber-400 font-semibold">
                        ต้นทุนรวม ฿{totalCostFiltered.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">{filtered.length} รายการ</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {FILTER_TABS.map(({ key, label }) => {
                    const count = countFor(key);
                    return (
                      <button key={key} onClick={() => setHistoryFilter(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                          historyFilter === key
                            ? "bg-white/10 border border-white/20 text-white"
                            : "bg-white/[0.03] border border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]"
                        }`}>
                        {label}
                        {count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-xs ${historyFilter === key ? "bg-white/20 text-white" : "bg-white/5 text-slate-600"}`}>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-slate-600 text-sm">ยังไม่มีรายการในหมวดนี้</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <th className="px-5 py-3.5">วันที่</th>
                        <th className="px-5 py-3.5">ประเภท</th>
                        <th className="px-5 py-3.5">สินค้า</th>
                        <th className="px-5 py-3.5 text-right">จำนวน</th>
                        {(historyFilter === "all" || historyFilter === "USAGE") && (
                          <th className="px-5 py-3.5 text-right">ต้นทุนรวม</th>
                        )}
                        <th className="px-5 py-3.5">context / แพทย์</th>
                        <th className="px-5 py-3.5">หมายเหตุ</th>
                        <th className="px-5 py-3.5">โดย</th>
                        {isSA && <th className="px-5 py-3.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const meta = TYPE_META[r.type] || { label: r.type, color: "text-slate-400", bg: "bg-white/5", border: "border-white/10" };
                        return (
                          <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">{r.date}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border whitespace-nowrap ${meta.bg} ${meta.border} ${meta.color}`}>
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-white font-medium">{r.product_name}</td>
                            <td className="px-5 py-3.5 text-right font-bold text-white">
                              {r.qty}
                              {r.unit && <span className="text-xs text-slate-500 font-normal ml-1">{r.unit}</span>}
                            </td>
                            {(historyFilter === "all" || historyFilter === "USAGE") && (
                              <td className="px-5 py-3.5 text-right">
                                {r.cost_total && r.cost_total > 0
                                  ? <span className="font-semibold text-amber-400">฿{r.cost_total.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                  : <span className="text-slate-700">—</span>}
                              </td>
                            )}
                            <td className="px-5 py-3.5 text-slate-400 text-xs">{r.context || "—"}</td>
                            <td className="px-5 py-3.5 text-slate-500 text-xs">{r.note || "—"}</td>
                            <td className="px-5 py-3.5 text-xs text-slate-600">{r.by}</td>
                            {isSA && (
                              <td className="px-5 py-3.5 text-right">
                                {r.usageRef && (
                                  <button onClick={() => openDeleteUsage(r.usageRef!)} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all">ลบ</button>
                                )}
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
          );
        })()}
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

          {/* บันทึกการใช้ — 3 modes */}
          {modal === "usage" && (
            <div className="relative w-full max-w-lg bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />
              <div className="relative p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
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

                {/* Mode tabs */}
                <div className="flex gap-1 mb-5 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                  {([
                    { key: "direct",     label: "ทั่วไป",      icon: "📦" },
                    { key: "conversion", label: "หน่วยย่อย",   icon: "⚗️" },
                    { key: "protocol",   label: "สูตร IV",      icon: "💉" },
                  ] as { key: UsageMode; label: string; icon: string }[]).map(({ key, label, icon }) => (
                    <button key={key} type="button"
                      onClick={() => { setUsageMode(key); setModalError(""); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${usageMode === key ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-slate-500 hover:text-slate-300"}`}>
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {modalSuccess && <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl mb-4">{modalSuccess}</p>}

                <form onSubmit={handleUsage} className="space-y-4">

                  {/* ── Mode: direct ────────────────────────────────────────── */}
                  {usageMode === "direct" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">สินค้า *</label>
                        <select value={useForm.product_id} onChange={(e) => setUseForm({ ...useForm, product_id: e.target.value })} onFocus={() => refreshAvailProducts(effectiveBid || undefined)} required className={selectCls}>
                          <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                          {availProducts.map((p) => <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">{p.product_name} — คงเหลือ {p.total_remaining} {p.unit}</option>)}
                        </select>
                        {selProduct && <div className="mt-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-1.5"><p className="text-xs text-purple-400">คงเหลือ: <span className="font-semibold">{selProduct.total_remaining} {selProduct.unit}</span></p></div>}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">จำนวนที่ใช้ ({selProduct?.unit || "หน่วย"}) *</label>
                        <input type="number" min="1" max={selProduct?.total_remaining} required value={useForm.qty_used} onChange={(e) => setUseForm({ ...useForm, qty_used: e.target.value })} placeholder="0" className={inputCls} />
                      </div>
                    </>
                  )}

                  {/* ── Mode: conversion ──────────────────────────────────── */}
                  {usageMode === "conversion" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">สินค้า (มี Dispense Config) *</label>
                        <select
                          value={convProduct?.product_id || ""}
                          onChange={(e) => {
                            const p = availProducts.find((x) => x.product_id.toString() === e.target.value) || null;
                            setConvProduct(p);
                            const cfg = p ? dispenseConfigs.find((c) => c.product_id.toString() === p.product_id.toString()) || null : null;
                            setConvConfig(cfg);
                            setConvQty("");
                          }}
                          className={selectCls}
                        >
                          <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                          {availProducts.filter((p) => dispenseConfigs.some((c) => c.product_id.toString() === p.product_id.toString())).map((p) => (
                            <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">{p.product_name} — คงเหลือ {p.total_remaining} {p.unit}</option>
                          ))}
                        </select>
                        {dispenseConfigs.length === 0 && <p className="text-xs text-amber-400 mt-1.5">ยังไม่มี Dispense Config — SA ต้องตั้งค่าก่อน</p>}
                      </div>
                      {convConfig && (
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 space-y-1">
                          <p className="text-xs text-violet-300 font-semibold">Config: {convConfig.product_name}</p>
                          <p className="text-xs text-slate-400">1 {convProduct?.unit} = <span className="text-white font-bold">{convConfig.units_per_stock}</span> {convConfig.dispense_unit}</p>
                          {convConfig.open_expiry_days != null && <p className="text-xs text-amber-400">หลังเปิดใช้งาน: หมดใน {convConfig.open_expiry_days} วัน</p>}
                        </div>
                      )}
                      {convConfig && (
                        <div>
                          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">จำนวนที่ใช้ ({convConfig.dispense_unit}) *</label>
                          <input type="number" min="0.01" step="0.01" value={convQty} onChange={(e) => setConvQty(e.target.value)} placeholder="0" className={inputCls} />
                          {convQty && Number(convQty) > 0 && (
                            <p className="text-xs text-slate-500 mt-1.5">
                              ≈ ตัด <span className="text-white font-semibold">{(Number(convQty) / convConfig.units_per_stock).toFixed(3)}</span> {convProduct?.unit}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Mode: protocol ─────────────────────────────────────── */}
                  {usageMode === "protocol" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">เลือก Protocol *</label>
                        <select
                          value={selectedProtocol}
                          onChange={(e) => {
                            setSelectedProtocol(e.target.value);
                            const p = protocols.find((x) => x.protocol_id === e.target.value);
                            if (p) {
                              setProtoIngredients(p.ingredients.map((ing) => {
                                const cfg = dispenseConfigs.find((c) => c.product_id.toString() === ing.product_id.toString());
                                return {
                                  ...ing,
                                  qty_edit: ing.qty,
                                  dispense_unit: cfg?.dispense_unit,
                                  units_per_stock: cfg?.units_per_stock,
                                  open_expiry_days: cfg?.open_expiry_days,
                                  use_conversion: !!cfg,
                                };
                              }));
                            } else {
                              setProtoIngredients([]);
                            }
                          }}
                          className={selectCls}
                        >
                          <option value="" className="bg-[#0d1526]">— เลือก Protocol —</option>
                          {protocols.map((p) => <option key={p.protocol_id} value={p.protocol_id} className="bg-[#0d1526]">{p.protocol_name} ({p.ingredients.length} รายการ)</option>)}
                        </select>
                        {protocols.length === 0 && <p className="text-xs text-amber-400 mt-1.5">ยังไม่มี Protocol — SA ต้องสร้างก่อน</p>}
                      </div>
                      {protoIngredients.length > 0 && (() => {
                        // คำนวณ stock warning ต่อ ingredient
                        const warnings = protoIngredients.map((ing) => {
                          const avail = availProducts.find((p) => p.product_id.toString() === ing.product_id.toString());
                          if (!avail) return { available: 0, notFound: true, insufficient: false };
                          const qtyNeeded = ing.qty_edit ?? ing.qty;
                          // conversion: qty_needed เป็น dispense_unit → แปลงเป็น stock_unit เพื่อเทียบ
                          const stockNeeded = ing.use_conversion && ing.units_per_stock
                            ? qtyNeeded / ing.units_per_stock
                            : qtyNeeded;
                          return {
                            available: avail.total_remaining,
                            unit: avail.unit,
                            notFound: false,
                            insufficient: stockNeeded > avail.total_remaining,
                          };
                        });
                        const anyWarn = warnings.some((w) => w.notFound || w.insufficient);

                        return (
                          <div className={`border rounded-xl overflow-hidden ${anyWarn ? "border-red-500/30" : "border-white/10"}`}>
                            <div className={`px-4 py-2 border-b flex items-center justify-between ${anyWarn ? "bg-red-500/5 border-red-500/20" : "bg-white/[0.03] border-white/5"}`}>
                              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">รายการ ingredient — แก้จำนวนได้</p>
                              {anyWarn && <span className="text-xs text-red-400 font-medium">⚠ สต๊อคไม่เพียงพอบางรายการ</span>}
                            </div>
                            <div className="divide-y divide-white/5">
                              {protoIngredients.map((ing, i) => {
                                const w = warnings[i];
                                const qtyNeeded = ing.qty_edit ?? ing.qty;
                                return (
                                  <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${(w.notFound || w.insufficient) ? "bg-red-500/5" : ""}`}>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm font-medium truncate">{ing.product_name}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {ing.use_conversion && ing.dispense_unit && (
                                          <span className="text-xs text-violet-400">หน่วยย่อย: {ing.dispense_unit}</span>
                                        )}
                                        {w.notFound ? (
                                          <span className="text-xs text-red-400">⚠ ไม่พบสินค้าในสต๊อค</span>
                                        ) : w.insufficient ? (
                                          <span className="text-xs text-red-400">
                                            ⚠ คงเหลือ {w.available} {w.unit} — ไม่เพียงพอ
                                          </span>
                                        ) : (
                                          <span className="text-xs text-emerald-500">
                                            ✓ คงเหลือ {w.available} {w.unit}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <input
                                      type="number" min="0.01" step="0.01"
                                      value={qtyNeeded}
                                      onChange={(e) => {
                                        const updated = [...protoIngredients];
                                        updated[i] = { ...updated[i], qty_edit: Number(e.target.value) };
                                        setProtoIngredients(updated);
                                      }}
                                      className={`w-20 border text-white text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none transition-colors ${
                                        (w.notFound || w.insufficient)
                                          ? "bg-red-500/10 border-red-500/40 focus:border-red-400"
                                          : "bg-white/5 border-white/10 focus:border-purple-500/50"
                                      }`}
                                    />
                                    <span className="text-xs text-slate-500 whitespace-nowrap w-16 text-right">
                                      {ing.use_conversion ? ing.dispense_unit : ing.unit}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* ── Doctor + Note (shared) ─────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">แพทย์ผู้ใช้</label>
                      {doctors.length > 0 ? (
                        <select value={useForm.doctor} onChange={(e) => setUseForm({ ...useForm, doctor: e.target.value })} onFocus={() => refreshDoctors(effectiveBid || undefined)} className={selectCls}>
                          <option value="" className="bg-[#0d1526]">— เลือกแพทย์ —</option>
                          {doctors.map((d) => <option key={d.name} value={d.name} className="bg-[#0d1526]">{d.name}{d.license ? ` (${d.license})` : ""}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={useForm.doctor} onChange={(e) => setUseForm({ ...useForm, doctor: e.target.value })} placeholder="ชื่อแพทย์ (ถ้ามี)" className={inputCls} />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">หมายเหตุ</label>
                      <input type="text" value={useForm.note} onChange={(e) => setUseForm({ ...useForm, note: e.target.value })} placeholder="หมายเหตุ (ถ้ามี)" className={inputCls} />
                    </div>
                  </div>

                  {modalError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{modalError}</p>}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                    <button type="submit" disabled={submitting}
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

          {/* ยาหาย */}
          {modal === "lost" && lostItem && (
            <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-orange-400/40 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">บันทึกยาหาย</h2>
                    <p className="text-slate-500 text-xs truncate max-w-[200px]">{lostItem.product_name}</p>
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-slate-500">Stock ID:</span>
                      <span className="font-mono text-xs text-violet-400">{lostItem.stock_id}</span>
                      <span className="ml-auto text-xs text-slate-500">คงเหลือ:</span>
                      <span className="text-xs font-bold text-emerald-400">{lostItem.qty_remaining} {lostItem.unit}</span>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">จำนวนที่หาย</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={lostItem.qty_remaining} value={lostQty} onChange={(e) => setLostQty(e.target.value)} placeholder="0" className={inputCls} autoFocus />
                        <span className="text-sm text-slate-500 whitespace-nowrap">{lostItem.unit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">หมายเหตุ <span className="text-slate-600">(ไม่บังคับ)</span></label>
                      <input type="text" value={lostNote} onChange={(e) => setLostNote(e.target.value)} placeholder="สาเหตุ..." className={inputCls} />
                    </div>
                    {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                      <button onClick={handleLost} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 16px rgba(249,115,22,0.3)" }}>
                        {submitting ? "กำลังบันทึก..." : "บันทึกยาหาย"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ส่งยาข้ามสาขา (SA only) */}
          {modal === "transferBranch" && transferItem && (
            <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">ส่งยาข้ามสาขา</h2>
                    <p className="text-slate-500 text-xs truncate max-w-[200px]">{transferItem.product_name}</p>
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-slate-500">จาก:</span>
                      <span className="text-xs text-white font-medium">{effectiveName}</span>
                      <span className="ml-auto text-xs text-slate-500">คงเหลือ:</span>
                      <span className="text-xs font-bold text-emerald-400">{transferItem.qty_remaining} {transferItem.unit}</span>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">สาขาปลายทาง</label>
                      <select value={transferToBranch} onChange={(e) => setTransferToBranch(e.target.value)} className={selectCls}>
                        <option value="" className="bg-[#0d1526]">— เลือกสาขา —</option>
                        {branches.filter((b) => b.branchId !== effectiveBid).map((b) => (
                          <option key={b.branchId} value={b.branchId} className="bg-[#0d1526]">{b.branchName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">จำนวนที่โอน</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={transferItem.qty_remaining} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="0" className={inputCls} />
                        <span className="text-sm text-slate-500 whitespace-nowrap">{transferItem.unit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">หมายเหตุ <span className="text-slate-600">(ไม่บังคับ)</span></label>
                      <input type="text" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="เหตุผล..." className={inputCls} />
                    </div>
                    {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                      <button onClick={handleTransferBranch} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-blue-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 16px rgba(14,165,233,0.3)" }}>
                        {submitting ? "กำลังโอน..." : "โอนยาไปสาขา"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ส่งคืนคลังกลาง (SA only) */}
          {modal === "returnCentral" && returnItem && (
            <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />
              <div className="relative p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-white font-semibold text-sm">ส่งคืนคลังกลาง</h2>
                    <p className="text-slate-500 text-xs truncate max-w-[200px]">{returnItem.product_name}</p>
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-xs text-slate-500">Stock ID:</span>
                      <span className="font-mono text-xs text-violet-400">{returnItem.stock_id}</span>
                      <span className="ml-auto text-xs text-slate-500">คงเหลือ:</span>
                      <span className="text-xs font-bold text-emerald-400">{returnItem.qty_remaining} {returnItem.unit}</span>
                    </div>
                    {returnItem.lot_id && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/5 border border-teal-500/10">
                        <span className="text-xs text-slate-500">Lot:</span>
                        <span className="font-mono text-xs text-teal-400">{returnItem.lot_id}</span>
                        <span className="ml-auto text-xs text-teal-500">qty จะคืนกลับ lot นี้</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">จำนวนที่ส่งคืน</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min={1} max={returnItem.qty_remaining} value={returnQty} onChange={(e) => setReturnQty(e.target.value)} placeholder="0" className={inputCls} autoFocus />
                        <span className="text-sm text-slate-500 whitespace-nowrap">{returnItem.unit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1.5">หมายเหตุ <span className="text-slate-600">(ไม่บังคับ)</span></label>
                      <input type="text" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} placeholder="เหตุผล..." className={inputCls} />
                    </div>
                    {modalError && <p className="text-xs text-red-400">{modalError}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>
                      <button onClick={handleReturnCentral} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 16px rgba(20,184,166,0.3)" }}>
                        {submitting ? "กำลังส่งคืน..." : "ส่งคืนคลังกลาง"}
                      </button>
                    </div>
                  </>
                )}
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

      {/* ══ Settings Modal (SA only) — standalone, outside {modal && ()} ══════ */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-slate-400/30 to-transparent" />
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-slate-500/15 border border-slate-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div className="flex-1">
                <h2 className="text-white font-semibold text-sm">ตั้งค่าระบบ INV</h2>
                <p className="text-slate-500 text-xs">Super Admin เท่านั้น</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 shrink-0">
              {([
                { key: "dispense", label: "⚗️ Dispense Config" },
                { key: "protocol", label: "💉 Protocol Manager" },
              ] as { key: SettingsTab; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setSettingsTab(key)}
                  className={`px-4 py-2 text-xs font-medium rounded-t-xl transition-all ${settingsTab === key ? "text-white bg-white/[0.06] border border-b-0 border-white/10" : "text-slate-500 hover:text-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 pb-6 pt-4 space-y-5">

              {/* ── Dispense Config tab ──────────────────────────────────── */}
              {settingsTab === "dispense" && (
                <>
                  <p className="text-xs text-slate-500">กำหนด 1 หน่วยใหญ่ = กี่หน่วยย่อย + อายุหลังเปิด</p>
                  <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{dcEditId ? "✏️ แก้ไข Config" : "➕ เพิ่ม Config ใหม่"}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 mb-1 block">สินค้า *</label>
                        <select
                          value={dcForm.product_id}
                          onChange={(e) => {
                            const p = products.find((x) => x.product_id.toString() === e.target.value);
                            setDcForm({ ...dcForm, product_id: e.target.value, product_name: p?.product_name || "" });
                          }}
                          className={selectCls}
                        >
                          <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                          {products.map((p) => (
                            <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">
                              {p.product_name}{p.unit ? ` (${p.unit})` : ""}
                            </option>
                          ))}
                        </select>
                        {products.length === 0 && <p className="text-xs text-amber-400 mt-1">ไม่พบ product list — ตรวจสอบ Master Data</p>}
                      </div>
                      <div><label className="text-xs text-slate-500 mb-1 block">หน่วยย่อย (dispense_unit) *</label><input value={dcForm.dispense_unit} onChange={(e) => setDcForm({ ...dcForm, dispense_unit: e.target.value })} placeholder="เช่น Units, shots, AMP" className={inputCls} /></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">หน่วยย่อยต่อ 1 หน่วยใหญ่ *</label><input type="number" min="1" value={dcForm.units_per_stock} onChange={(e) => setDcForm({ ...dcForm, units_per_stock: e.target.value })} placeholder="เช่น 200" className={inputCls} /></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">อายุหลังเปิด (วัน) — ว่างได้</label><input type="number" min="1" value={dcForm.open_expiry_days} onChange={(e) => setDcForm({ ...dcForm, open_expiry_days: e.target.value })} placeholder="เช่น 14 (ว่าง = ตามกล่อง)" className={inputCls} /></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">หมายเหตุ</label><input value={dcForm.notes} onChange={(e) => setDcForm({ ...dcForm, notes: e.target.value })} placeholder="หมายเหตุ" className={inputCls} /></div>
                    </div>
                    {dcError && <p className="text-xs text-red-400">{dcError}</p>}
                    <div className="flex gap-2 pt-1">
                      {dcEditId && <button type="button" onClick={() => { setDcEditId(null); setDcForm({ product_id: "", product_name: "", dispense_unit: "", units_per_stock: "", open_expiry_days: "", notes: "" }); setDcError(""); }} className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>}
                      <button type="button" onClick={handleDcSave} disabled={dcSubmitting} className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-500 to-purple-400 text-white hover:opacity-90 disabled:opacity-50 transition-all">
                        {dcSubmitting ? "กำลังบันทึก..." : dcEditId ? "บันทึกการแก้ไข" : "เพิ่ม Config"}
                      </button>
                    </div>
                  </div>
                  {dcLoading ? (
                    <div className="flex justify-center py-6"><div className="w-6 h-6 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" /></div>
                  ) : dispenseConfigs.length === 0 ? (
                    <p className="text-center text-slate-600 text-sm py-4">ยังไม่มี config</p>
                  ) : (
                    <div className="border border-white/8 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-slate-500 uppercase tracking-wider border-b border-white/5 bg-white/[0.02]">
                          <th className="px-4 py-2.5">Product ID</th><th className="px-4 py-2.5">ชื่อ</th>
                          <th className="px-4 py-2.5 text-center">1 หน่วยใหญ่</th><th className="px-4 py-2.5 text-center">อายุหลังเปิด</th><th className="px-4 py-2.5" />
                        </tr></thead>
                        <tbody>
                          {dispenseConfigs.map((cfg) => (
                            <tr key={cfg.config_id} className="border-t border-white/5 hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 font-mono text-violet-400">{cfg.product_id}</td>
                              <td className="px-4 py-2.5 text-white">{cfg.product_name || "—"}</td>
                              <td className="px-4 py-2.5 text-center text-slate-300">= <span className="font-bold text-white">{cfg.units_per_stock}</span> {cfg.dispense_unit}</td>
                              <td className="px-4 py-2.5 text-center">{cfg.open_expiry_days != null ? <span className="text-amber-400">{cfg.open_expiry_days} วัน</span> : <span className="text-slate-600">ตามกล่อง</span>}</td>
                              <td className="px-4 py-2.5"><div className="flex gap-1.5 justify-end">
                                <button onClick={() => startDcEdit(cfg)} className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all">แก้ไข</button>
                                <button onClick={() => handleDcDelete(cfg.config_id)} className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">ลบ</button>
                              </div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Protocol Manager tab ─────────────────────────────────── */}
              {settingsTab === "protocol" && (
                <>
                  <p className="text-xs text-slate-500">สร้างสูตร IV — เลือกสินค้า + จำนวนต่อสูตร</p>
                  <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-3">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{ptEditId ? "✏️ แก้ไข Protocol" : "➕ สร้าง Protocol ใหม่"}</p>
                    <div><label className="text-xs text-slate-500 mb-1 block">ชื่อสูตร *</label><input value={ptForm.protocol_name} onChange={(e) => setPtForm({ ...ptForm, protocol_name: e.target.value })} placeholder="เช่น สูตรขาวใส" className={inputCls} /></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-medium">รายการ ingredient</p>
                        <button type="button" onClick={() => setPtIngredients([...ptIngredients, { product_id: "", product_name: "", qty: "1", unit: "" }])} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">+ เพิ่มรายการ</button>
                      </div>
                      {ptIngredients.map((ing, i) => (
                        <div key={i} className="grid grid-cols-[2fr_80px_80px_32px] gap-2 items-center">
                          <select
                            value={ing.product_id}
                            onChange={(e) => {
                              const p = products.find((x) => x.product_id.toString() === e.target.value);
                              const u = [...ptIngredients];
                              u[i] = { ...u[i], product_id: e.target.value, product_name: p?.product_name || "", unit: p?.unit || u[i].unit };
                              setPtIngredients(u);
                            }}
                            className={selectCls}
                          >
                            <option value="" className="bg-[#0d1526]">— เลือกสินค้า —</option>
                            {products.map((p) => (
                              <option key={p.product_id} value={p.product_id} className="bg-[#0d1526]">
                                {p.product_name}{p.unit ? ` (${p.unit})` : ""}
                              </option>
                            ))}
                          </select>
                          <input type="number" min="0.01" step="0.01" value={ing.qty} onChange={(e) => { const u = [...ptIngredients]; u[i] = { ...u[i], qty: e.target.value }; setPtIngredients(u); }} placeholder="qty" className={inputCls} />
                          <input value={ing.unit} onChange={(e) => { const u = [...ptIngredients]; u[i] = { ...u[i], unit: e.target.value }; setPtIngredients(u); }} placeholder="หน่วย" className={inputCls} />
                          <button type="button" onClick={() => setPtIngredients(ptIngredients.filter((_, j) => j !== i))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                    {ptError && <p className="text-xs text-red-400">{ptError}</p>}
                    <div className="flex gap-2 pt-1">
                      {ptEditId && <button type="button" onClick={() => { setPtEditId(null); setPtForm({ protocol_name: "" }); setPtIngredients([{ product_id: "", product_name: "", qty: "1", unit: "" }]); setPtError(""); }} className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">ยกเลิก</button>}
                      <button type="button" onClick={handlePtSave} disabled={ptSubmitting} className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 text-white hover:opacity-90 disabled:opacity-50 transition-all">
                        {ptSubmitting ? "กำลังบันทึก..." : ptEditId ? "บันทึกการแก้ไข" : "สร้าง Protocol"}
                      </button>
                    </div>
                  </div>
                  {ptLoading ? (
                    <div className="flex justify-center py-6"><div className="w-6 h-6 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" /></div>
                  ) : protocols.length === 0 ? (
                    <p className="text-center text-slate-600 text-sm py-4">ยังไม่มี Protocol</p>
                  ) : (
                    <div className="space-y-3">
                      {protocols.map((p) => (
                        <div key={p.protocol_id} className="border border-white/8 rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/5">
                            <div className="flex-1">
                              <p className="text-white font-semibold text-sm">{p.protocol_name}</p>
                              <p className="text-xs text-slate-500 font-mono">{p.protocol_id} · {p.ingredients.length} รายการ</p>
                            </div>
                            <button onClick={() => startPtEdit(p)} className="px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 text-xs transition-all">แก้ไข</button>
                            <button onClick={() => handlePtDelete(p.protocol_id)} className="px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs transition-all">ลบ</button>
                          </div>
                          <div className="divide-y divide-white/5">
                            {p.ingredients.map((ing, i) => (
                              <div key={i} className="flex items-center gap-3 px-4 py-2">
                                <span className="w-5 h-5 rounded-md bg-white/5 text-slate-500 text-xs flex items-center justify-center shrink-0">{ing.sort}</span>
                                <span className="text-white text-sm flex-1">{ing.product_name || ing.product_id}</span>
                                <span className="text-slate-300 text-sm font-bold">{ing.qty}</span>
                                <span className="text-slate-500 text-xs w-12 text-right">{ing.unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
