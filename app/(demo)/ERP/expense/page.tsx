"use client";

import { useEffect, useRef, useMemo, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ImageUpload from "@/app/components/ImageUpload";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

interface FormField {
  fieldName:   string;
  label:       string;
  type:        string;
  required:    boolean;
  helper:      string | null;
  order:       number;
  placeholder: string;
  validation:  string | null;
  section?:    string;
  notes?:      string;
}

interface HelperOption  { value: string; label: string; }
interface EntryRow      { _rowIndex: number; [key: string]: any; }
interface FeeConfigItem { field_name: string; label: string; fee_pct: number; active: boolean; }
interface FeeCalcResult { field_name: string; label: string; sales_sum: number; fee_pct: number; fee_amount: number; type: "fee" | "vat"; }

const SALARY_KEYS = ["salary", "เงินเดือน", "ค่าจ้าง", "payroll", "wage"];
const BRANCH_KEYS = ["branch_id", "branchid", "branch", "สาขา"];
const PERIOD_KEYS = ["period", "เดือน", "month", "งวด"];

const isSalaryField = (f: FormField) =>
  SALARY_KEYS.some((k) => f.fieldName.toLowerCase().includes(k) || f.label.includes(k));
const isBranchField = (f: FormField) =>
  BRANCH_KEYS.some((k) => f.fieldName.toLowerCase() === k);
const isPeriodField = (f: FormField) =>
  PERIOD_KEYS.some((k) => f.fieldName.toLowerCase() === k || f.label === k);

function currentPeriod() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
}

function ExpensePage() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";
  const configName    = searchParams.get("configName")    || "EXPENSE_CONFIG";
  const sheetName     = searchParams.get("sheetName")     || "Expense_Data";
  const histSheetName = searchParams.get("histSheet")     || "Expense Transaction";
  const moduleTitle   = searchParams.get("title")         || "ค่าใช้จ่าย";

  const [navOpen, setNavOpen] = useState(false);

  // ── Branch state ─────────────────────────────────────────────────────────────
  const [branchId,          setBranchId]          = useState<string | null>(null);
  const [branchName,        setBranchName]        = useState<string | null>(null);
  const [allBranches,       setAllBranches]       = useState<{ branchId: string; branchName: string }[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [branchLoaded,      setBranchLoaded]      = useState(false);
  const isCentral = branchId === "central";
  const [userRole,    setUserRole]    = useState<string>("STAFF");
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  // ── Period dropdown ──────────────────────────────────────────────────────────
  const [period,          setPeriod]          = useState(currentPeriod());
  const [periods,         setPeriods]         = useState<string[]>([]);
  const [periodsLoading,  setPeriodsLoading]  = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────────
  const [formFields,    setFormFields]    = useState<FormField[]>([]);
  const [helperOptions, setHelperOptions] = useState<Record<string, HelperOption[]>>({});
  const [formData,      setFormData]      = useState<Record<string, string>>({});

  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Salary pull ───────────────────────────────────────────────────────────────
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryInfo,    setSalaryInfo]    = useState<{ total: number; count: number } | null>(null);
  const [salaryDebug,   setSalaryDebug]   = useState<string | null>(null);

  // ── Fee Config & Auto-fee ─────────────────────────────────────────────────
  const [feeConfigs,     setFeeConfigs]     = useState<FeeConfigItem[]>([]);
  const [feeModalOpen,   setFeeModalOpen]   = useState(false);
  const [feePreview,     setFeePreview]     = useState<FeeCalcResult[] | null>(null);
  const [feePreviewOpen, setFeePreviewOpen] = useState(false);
  const [feeLoading,     setFeeLoading]     = useState(false);
  const [feeSaving,      setFeeSaving]      = useState(false);
  const [feeError,       setFeeError]       = useState<string | null>(null);
  const [feeInfo,        setFeeInfo]        = useState<{ total: number; count: number } | null>(null);
  const feeAutoSavedRef  = useRef<Set<string>>(new Set());

  // ── Batch auto-fee ────────────────────────────────────────────────────────
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchDone,       setBatchDone]       = useState(false);
  const [previewOpen,     setPreviewOpen]     = useState(false);
  const [previewLoading,  setPreviewLoading]  = useState(false);
  const [previewData,     setPreviewData]     = useState<null | {
    previewRows: { dateStr: string; period: string; branchId: string; branchName: string; label: string; amount: number; channel: string; salesBase: number; feePct: number; status: "append" | "skip_existing" | "zero_sales" | "zero_pct" }[];
    dateMap:     Record<string, Record<string, Record<string, number>>>;
    totalSaved:  number;
    results:     { date: string; branchId: string; saved: number; skipped: number; zeroAmt: number }[];
    debugInfo?:  { idToNameMap: Record<string,string>; dateMapBranches: string[]; feeConfigBranches: string[]; expDateColIdx?: number; expDateColName?: string };
  }>(null);
  const batchRanRef = useRef(false); // ยิงแค่ครั้งเดียวต่อ page load

  // ── History (entries) ─────────────────────────────────────────────────────────
  const [entries,        setEntries]        = useState<EntryRow[]>([]);
  const [entryHeaders,   setEntryHeaders]   = useState<string[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [autoSaving,     setAutoSaving]     = useState(false);

  // ── Image lightbox ───────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────────
  const [editRow,    setEditRow]    = useState<EntryRow | null>(null);
  const [editData,   setEditData]   = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ป้องกัน auto-save ซ้ำ — key = "period|branchId|total"
  const autoSavedRef    = useRef<Set<string>>(new Set());

  // ── Derived ───────────────────────────────────────────────────────────────────
  const effectiveBranchId = isCentral
    ? allBranches.find((b) => b.branchName === selectedBranchName)?.branchId || ""
    : branchId || "";

  // ── 1. Branch check ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    fetch("/api/auth/branch-check")
      .then((r) => r.json())
      .then((d) => {
        setBranchId(d.branchId || null);
        setBranchName(d.branchName || null);
        setUserRole((d.role ?? "STAFF").toString().trim().toUpperCase());
        if (d.branchId === "central") {
          fetch("/api/auth/branches").then((r) => r.json()).then((b) => setAllBranches(b.branches || []));
        }
      })
      .finally(() => setBranchLoaded(true));
  }, [session]);

  // ── 2. Load config + helpers ──────────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (!branchLoaded || status !== "authenticated" || !spreadsheetId) return;
    fetchConfig();
  }, [status, branchLoaded, spreadsheetId]);

  const fetchHelpers = useCallback(async (fields: FormField[], filterBranch: string | null, fresh = false) => {
    const helperFields = fields.filter((f) => f.helper && f.type === "dropdown");
    if (!helperFields.length) return;
    const results = await Promise.all(
      helperFields.map(async (f) => {
        try {
          const url = new URL(window.location.origin + "/api/helpers-branch");
          url.searchParams.set("spreadsheetId", spreadsheetId);
          url.searchParams.set("helperName", f.helper!);
          if (filterBranch) url.searchParams.set("branchId", filterBranch);
          if (fresh) url.searchParams.set("fresh", "1");
          const res  = await fetch(url.toString());
          const json = res.ok ? await res.json() : {};
          return { name: f.helper!, opts: json.options || [] };
        } catch { return { name: f.helper!, opts: [] }; }
      })
    );
    const map: Record<string, HelperOption[]> = {};
    results.forEach(({ name, opts }) => { map[name] = opts; });
    setHelperOptions(map);
  }, [spreadsheetId]);

  // refetch helper เดี่ยว (fresh) เมื่อ dropdown ถูก focus
  const refreshHelper = useCallback(async (helperName: string) => {
    const filterBranch = isCentral
      ? allBranches.find((b) => b.branchName === selectedBranchName)?.branchId || null
      : branchId;
    try {
      const url = new URL(window.location.origin + "/api/helpers-branch");
      url.searchParams.set("spreadsheetId", spreadsheetId);
      url.searchParams.set("helperName", helperName);
      if (filterBranch) url.searchParams.set("branchId", filterBranch);
      url.searchParams.set("fresh", "1");
      const res  = await fetch(url.toString());
      const json = res.ok ? await res.json() : {};
      setHelperOptions((prev) => ({ ...prev, [helperName]: json.options || [] }));
    } catch { /* silent */ }
  }, [spreadsheetId, isCentral, branchId, selectedBranchName, allBranches]);

  async function fetchConfig() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/module/config?spreadsheetId=${spreadsheetId}&configName=${encodeURIComponent(configName)}`);
      const data = await res.json();
      if (!res.ok) {
        // sheet ไม่มี = non-fatal → ข้ามฟอร์ม แต่ยังใช้ history + batch ได้
        if (data.code === "FETCH_ERROR") {
          setFormFields([]);
          return;
        }
        throw new Error(data.message || data.error || "Load config failed");
      }
      const fields: FormField[] = data.fields || [];
      setFormFields(fields);
      const blank: Record<string, string> = {};
      fields.forEach((f) => { blank[f.fieldName] = ""; });
      setFormData(blank);
      const filterBranch = branchId === "central" ? null : branchId;
      await fetchHelpers(fields, filterBranch);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // re-fetch helpers when central selects a branch
  useEffect(() => {
    if (!isCentral || !formFields.length) return;
    const b = allBranches.find((b) => b.branchName === selectedBranchName);
    fetchHelpers(formFields, b ? b.branchId : null);
  }, [selectedBranchName]);

  // ── 3. Load periods จาก Expense Transaction sheet ────────────────────────────
  const loadPeriods = useCallback(async (bid: string) => {
    if (!spreadsheetId) return;
    setPeriodsLoading(true);
    try {
      const url = new URL(window.location.origin + "/api/expense/periods");
      url.searchParams.set("spreadsheetId", spreadsheetId);
      url.searchParams.set("sheetName", histSheetName);
      if (bid) url.searchParams.set("branchId", bid);
      const res  = await fetch(url.toString());
      const data = res.ok ? await res.json() : {};
      const list: string[] = data.periods || [];
      setPeriods(list);
      // default to latest period that exists, or current if none
      if (list.length && !list.includes(period)) setPeriod(list[0]);
    } catch { /* silent */ }
    finally { setPeriodsLoading(false); }
  }, [spreadsheetId]);

  useEffect(() => {
    if (!branchLoaded || !spreadsheetId) return;
    loadPeriods(effectiveBranchId);
  }, [branchLoaded, effectiveBranchId, spreadsheetId]);

  // ── 4. Auto-pull payroll salary when period/branch changes ────────────────────
  const pullPayrollSalary = useCallback(async (pid: string, bid: string, _fields: FormField[]) => {
    if (!pid || !bid) { setSalaryDebug(`pid="${pid}" bid="${bid}" — ยังไม่พร้อม`); return; }
    setSalaryLoading(true); setSalaryDebug(null);
    try {
      const url = `/api/expense/payroll-total?spreadsheetId=${spreadsheetId}&period=${encodeURIComponent(pid)}&branchId=${encodeURIComponent(bid)}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!res.ok) { setSalaryDebug(`API error ${res.status}: ${data.error || JSON.stringify(data)}`); return; }
      const sampleStr = (data.sample || []).map((s: any) => `[p=${s.p}|b=${s.b}|net=${s.net}]`).join(" ");
      setSalaryDebug(`total=${data.total} count=${data.count} | colOffset=${data.colOffset} bCol=${data.bCol} nCol=${data.nCol} | ${sampleStr || "ไม่มี rows"} | payroll-headers: ${data.headerDump || "?"}`);
      setSalaryInfo({ total: data.total, count: data.count });
    } catch (e: any) { setSalaryDebug(`fetch error: ${e.message}`); }
    finally { setSalaryLoading(false); }
  }, [spreadsheetId]);

  useEffect(() => {
    if (!branchLoaded) return;
    pullPayrollSalary(period, effectiveBranchId, formFields);
  }, [period, effectiveBranchId, branchLoaded]);

  // ── Fee Config functions ──────────────────────────────────────────────────
  const loadFeeConfig = useCallback(async (bid?: string) => {
    if (!spreadsheetId) return;
    const targetBid = bid ?? effectiveBranchId;
    if (!targetBid) return;
    try {
      const url = new URL(window.location.origin + "/api/expense/fee-config");
      url.searchParams.set("spreadsheetId", spreadsheetId);
      url.searchParams.set("branchId", targetBid);
      const res  = await fetch(url.toString());
      const data = res.ok ? await res.json() : {};
      setFeeConfigs(data.configs || []);
    } catch { /* silent */ }
  }, [spreadsheetId, effectiveBranchId]);

  const saveFeeConfig = useCallback(async () => {
    if (!spreadsheetId || !feeConfigs.length) return;
    setFeeSaving(true); setFeeError(null);
    try {
      const res = await fetch("/api/expense/fee-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, branchId: effectiveBranchId, configs: feeConfigs }),
      });
      const data = res.ok ? await res.json() : await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setFeeModalOpen(false);
    } catch (e: any) { setFeeError(e.message); }
    finally { setFeeSaving(false); }
  }, [spreadsheetId, effectiveBranchId, feeConfigs]);

  const pullFeePreview = useCallback(async () => {
    if (!spreadsheetId || !period || !effectiveBranchId) return;
    // clear ref → เมื่อ user กด manual ให้ force re-save เสมอ
    for (const k of feeAutoSavedRef.current) {
      if (k.startsWith(`${period}|${effectiveBranchId}|`)) feeAutoSavedRef.current.delete(k);
    }
    setFeeLoading(true); setFeeError(null);
    try {
      const res = await fetch("/api/expense/auto-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          histSheetName: histSheetName,
          period,
          branchId: effectiveBranchId,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "คำนวณไม่สำเร็จ");
      setFeePreview(data.calculations || []);
      setFeePreviewOpen(true);
    } catch (e: any) { setFeeError(e.message); }
    finally { setFeeLoading(false); }
  }, [spreadsheetId, period, effectiveBranchId, histSheetName]);

  // ── Batch auto-fee: ยิงครั้งเดียวตอน load — ครอบทุก branch × period ────────
  const runBatchAutoFee = useCallback(async () => {
    console.log("[batch] runBatchAutoFee called", { ran: batchRanRef.current, spreadsheetId, isCentral, allBranches: allBranches.length, branchId, periods: periods.length });
    if (batchRanRef.current || !spreadsheetId) return;

    const targetBranchIds = isCentral
      ? allBranches.map((b) => b.branchId)
      : branchId ? [branchId] : [];

    console.log("[batch] targetBranchIds:", targetBranchIds, "periods:", periods);
    if (!targetBranchIds.length) { console.warn("[batch] no targetBranchIds — abort"); return; }

    batchRanRef.current = true;
    setBatchProcessing(true);
    setFeeError(null);

    try {
      const branchMapping = isCentral
        ? allBranches.map((b) => ({ branchId: b.branchId, branchName: b.branchName }))
        : branchId ? [{ branchId, branchName: branchName || branchId }] : [];
      // ไม่ส่ง periods → ให้ batch auto-discover จาก Helper_Sales (ครอบทุก period ที่มียอดขาย)
      const payload = { spreadsheetId, histSheetName, branchIds: targetBranchIds, branchMapping, dryRun: false };
      console.log("[batch] POST /api/expense/auto-fee/batch", payload);

      const res  = await fetch("/api/expense/auto-fee/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[batch] response", res.status, data);

      if (!res.ok) {
        setFeeError(data?.error || "batch auto-fee ไม่สำเร็จ");
        batchRanRef.current = false; // allow retry on next load
        return;
      }
      setBatchDone(true);
      if (data.totalSaved > 0) loadEntries(period, effectiveBranchId);
    } catch (e: any) {
      console.error("[batch] fetch error:", e);
      setFeeError(e.message || "batch auto-fee error");
      batchRanRef.current = false;
    } finally {
      setBatchProcessing(false);
    }
  }, [spreadsheetId, histSheetName, isCentral, allBranches, branchId, periods, period, effectiveBranchId]);

  // ── dryRun preview ────────────────────────────────────────────────────────────
  const runDryRun = useCallback(async () => {
    if (!spreadsheetId) return;
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewOpen(true);
    try {
      const targetBranchIds = isCentral
        ? allBranches.map((b) => b.branchId)
        : branchId ? [branchId] : [];
      const branchMapping = isCentral
        ? allBranches.map((b) => ({ branchId: b.branchId, branchName: b.branchName }))
        : branchId ? [{ branchId, branchName: branchName || branchId }] : [];
      const res  = await fetch("/api/expense/auto-fee/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, histSheetName, branchIds: targetBranchIds, branchMapping, dryRun: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFeeError(data?.error || "dryRun error"); setPreviewOpen(false); return; }
      setPreviewData(data);
    } catch (e: any) {
      setFeeError(e.message || "dryRun error");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [spreadsheetId, histSheetName, isCentral, allBranches, branchId, branchName]);

  // trigger เมื่อข้อมูล branch + periods พร้อม
  useEffect(() => {
    console.log("[batch] trigger check:", { branchLoaded, spreadsheetId: !!spreadsheetId, periodsLoading, isCentral, allBranchesLen: allBranches.length, branchId });
    if (!branchLoaded || !spreadsheetId || periodsLoading) return;
    if (isCentral && allBranches.length === 0) return;
    if (!isCentral && !branchId) return;
    runBatchAutoFee();
  }, [branchLoaded, periodsLoading, allBranches.length, branchId]);

  const confirmFees = useCallback(async () => {
    if (!spreadsheetId || !period || !effectiveBranchId) return;
    // clear ref ทุก key ของ period+branch นี้ → บังคับ auto-save re-fire หลัง confirm
    for (const k of feeAutoSavedRef.current) {
      if (k.startsWith(`${period}|${effectiveBranchId}|`)) feeAutoSavedRef.current.delete(k);
    }
    setFeeSaving(true); setFeeError(null);
    try {
      const res = await fetch("/api/expense/auto-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          histSheetName: histSheetName,
          period,
          branchId: effectiveBranchId,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setFeePreviewOpen(false);
      setFeePreview(null);
      // อัปเดต banner สรุปให้ตรงกับผลที่เพิ่งบันทึก
      if (data.totalFees != null) {
        setFeeInfo({ total: data.totalFees, count: (data.calculations || []).length });
      }
      loadEntries(period, effectiveBranchId);
    } catch (e: any) { setFeeError(e.message); }
    finally { setFeeSaving(false); }
  }, [spreadsheetId, period, effectiveBranchId, histSheetName]);

  // ── 5. Load history entries จาก Expense Transaction sheet ────────────────────
  const loadEntries = useCallback(async (pid: string, bid: string) => {
    if (!spreadsheetId || !pid) return;
    setEntriesLoading(true);
    try {
      const url = new URL(window.location.origin + "/api/expense/entries");
      url.searchParams.set("spreadsheetId", spreadsheetId);
      url.searchParams.set("sheetName", histSheetName);
      url.searchParams.set("period", pid);
      if (bid) url.searchParams.set("branchId", bid);
      const res  = await fetch(url.toString());
      const data = res.ok ? await res.json() : {};
      setEntries(data.entries || []);
      setEntryHeaders(data.headers || []);
    } catch { /* silent */ }
    finally { setEntriesLoading(false); }
  }, [spreadsheetId, histSheetName]);

  useEffect(() => {
    if (!branchLoaded || !period) return;
    loadEntries(period, effectiveBranchId);
  }, [period, effectiveBranchId, branchLoaded]);

  // ── 6. Auto-save payroll row → Expense Transaction ───────────────────────────
  useEffect(() => {
    if (!salaryInfo || salaryInfo.total <= 0) return;
    if (salaryLoading || entriesLoading || !period) return;

    const bid = effectiveBranchId;
    const key = `${period}|${bid}|${salaryInfo.total}`;
    if (autoSavedRef.current.has(key)) return;

    // หา raw headers จากชีทจริง
    const catHeader  = entryHeaders.find((h) => h.includes("หมวด")) || "";
    const amtHeader  = entryHeaders.find((h) => h.includes("ยอดเงิน") || h.toLowerCase().includes("amount")) || "";
    const chanHeader = entryHeaders.find((h) => h.includes("ชำระ") || h.toLowerCase().includes("channel")) || "";
    const dateHeader = entryHeaders.find((h) => h.includes("วันที่") || h.toLowerCase() === "date") || "";

    // รอ headers โหลดก่อน
    if (!amtHeader) return;

    if (!bid) return;

    // หาแถว "ค่าจ้างพนักงาน" ที่มีอยู่แล้ว (ถ้ามี)
    const existingPayrollRow = catHeader
      ? entries.find((row) => (row[catHeader] ?? "").toString().includes("ค่าจ้างพนักงาน"))
      : undefined;

    const amtMatches = existingPayrollRow && amtHeader
      ? Math.abs(Number((existingPayrollRow[amtHeader] ?? "").toString().replace(/,/g, "")) - salaryInfo.total) < 0.01
      : false;

    // ยอดเดิมตรงกันแล้ว — ไม่ต้องทำอะไร
    if (amtMatches) { autoSavedRef.current.add(key); return; }

    // วันสุดท้ายของเดือน (DD/MM/YYYY)
    const [mm, yyyy] = period.split("/");
    const lastDay = new Date(parseInt(yyyy), parseInt(mm), 0).getDate();
    const dateStr = `${lastDay.toString().padStart(2, "0")}/${mm}/${yyyy}`;

    setAutoSaving(true);

    if (existingPayrollRow) {
      // ยอดเปลี่ยน → PATCH แค่ field ยอดเงิน
      fetch("/api/expense/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          sheetName: histSheetName,
          rowIndex: existingPayrollRow._rowIndex,
          fields: amtHeader ? { [amtHeader]: salaryInfo.total.toString() } : {},
        }),
      })
        .then(async (r) => {
          if (r.ok) { autoSavedRef.current.add(key); loadEntries(period, bid); }
          else { const e = await r.json().catch(() => ({})); setSalaryDebug(`patch error ${r.status}: ${e.error || JSON.stringify(e)}`); }
        })
        .catch((e) => setSalaryDebug(`patch fetch error: ${e.message}`))
        .finally(() => setAutoSaving(false));
    } else {
      // ไม่มีแถวเดิม → insert ใหม่ (date-sorted)
      const lineItem: Record<string, any> = {};
      const fieldsConfig: Array<{ fieldName: string; type?: string }> = [];
      const addField = (header: string, value: string, type?: string) => {
        if (!header) return;
        lineItem[header] = value;
        fieldsConfig.push({ fieldName: header, ...(type ? { type } : {}) });
      };
      addField(catHeader,  "ค่าจ้างพนักงาน");
      addField(amtHeader,  salaryInfo.total.toString());
      addField(chanHeader, "โอน");
      addField(dateHeader, dateStr, "date");

      fetch("/api/expense/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          sheetName: histSheetName,
          period,
          branchId: bid,
          formData: { lineItems: [lineItem] },
          fields: fieldsConfig,
        }),
      })
        .then(async (r) => {
          if (r.ok) { autoSavedRef.current.add(key); loadEntries(period, bid); }
          else { const e = await r.json().catch(() => ({})); setSalaryDebug(`auto-save error ${r.status}: ${e.error || JSON.stringify(e)}`); }
        })
        .catch((e) => setSalaryDebug(`auto-save fetch error: ${e.message}`))
        .finally(() => setAutoSaving(false));
    }
  }, [salaryInfo, salaryLoading, entriesLoading, entries.length, entryHeaders.length, period, effectiveBranchId]);

  // ── 6. Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveBranch = isCentral ? selectedBranchName : branchName;
    if (!effectiveBranch) {
      setError(isCentral ? "กรุณาเลือกสาขา" : "ไม่พบข้อมูลสาขา");
      return;
    }

    setSubmitting(true); setError(null);
    try {
      const rowData: Record<string, string> = { ...formData };
      formFields.forEach((f) => {
        if (isPeriodField(f)) rowData[f.fieldName] = period;
        if (isBranchField(f)) rowData[f.fieldName] = effectiveBranchId || effectiveBranch;
      });

      const payload = {
        spreadsheetId,
        sheetName: histSheetName,          // เขียนลง Expense Transaction เหมือน history
        formData:  { lineItems: [rowData] },
        fields:    formFields,
        period,
        branchId:  effectiveBranchId || effectiveBranch,
      };

      const res = await fetch("/api/expense/submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || e.message || "Failed"); }

      setSuccess(true);
      const blank: Record<string, string> = {};
      formFields.forEach((f) => { blank[f.fieldName] = ""; });
      setFormData(blank);
      setSalaryInfo(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setSuccess(false), 5000);

      pullPayrollSalary(period, effectiveBranchId, formFields);
      loadEntries(period, effectiveBranchId);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  // ── 7. Delete entry ───────────────────────────────────────────────────────────
  async function handleDelete(rowIndex: number) {
    setDeleting(true);
    try {
      const res = await fetch("/api/expense/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, sheetName: histSheetName, rowIndex }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "ลบไม่สำเร็จ"); }
      setDeleteConfirm(null);
      loadEntries(period, effectiveBranchId);
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  }

  // ── 8. Edit entry ─────────────────────────────────────────────────────────────
  function openEdit(row: EntryRow) {
    const pre: Record<string, string> = {};
    formFields.forEach((f) => {
      const raw = headerMap[f.fieldName];
      pre[f.fieldName] = raw ? (row[raw] ?? "").toString() : (row[f.fieldName] ?? row[f.label] ?? "").toString();
    });
    setEditData(pre);
    setEditRow(row);
  }

  async function handleEditSave() {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const fields: Record<string, string> = {};
      formFields.forEach((f) => {
        if (!isPeriodField(f) && !isBranchField(f)) fields[f.fieldName] = editData[f.fieldName] ?? "";
      });
      const res = await fetch("/api/expense/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, sheetName: histSheetName, rowIndex: editRow._rowIndex, fields }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "แก้ไขไม่สำเร็จ"); }
      setEditRow(null);
      loadEntries(period, effectiveBranchId);
    } catch (e: any) { setError(e.message); }
    finally { setEditSaving(false); }
  }

  // ── Render field ──────────────────────────────────────────────────────────────
  const baseInput = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all";
  const baseLabel = "block text-sm font-semibold text-slate-300 mb-1.5";

  function renderField(f: FormField) {
    const value    = formData[f.fieldName] || "";
    const onChange = (val: string) => setFormData((p) => ({ ...p, [f.fieldName]: val }));

    if (isPeriodField(f) || isBranchField(f)) return null;

    if (isSalaryField(f)) {
      return (
        <div>
          <label className={baseLabel}>
            {f.label}
            {f.required && <span className="text-red-400 ml-1">*</span>}
            <span className="ml-2 text-[10px] font-normal text-orange-400/80 normal-case">
              {salaryLoading ? "กำลังดึงข้อมูล..." : salaryInfo ? `จาก Payroll ${salaryInfo.count} คน` : "อัปเดตอัตโนมัติ"}
            </span>
          </label>
          <div className="relative">
            <input type="number" value={value} readOnly placeholder="ดึงจาก Payroll อัตโนมัติ"
              className={`${baseInput} bg-orange-500/5 border-orange-500/20 text-orange-300 cursor-not-allowed`} />
            {salaryLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      );
    }

    switch (f.type) {
      case "image":
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <ImageUpload fieldName={f.fieldName} label={f.label} required={f.required} value={value} onChange={onChange} />
          </div>
        );

      case "dropdown": {
        const options = helperOptions[f.helper!] || [];
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <select value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => { if (f.helper) refreshHelper(f.helper); }}
              className={`${baseInput} cursor-pointer`} required={f.required}>
              <option value="" className="bg-[#0f1629]">-- {f.placeholder || "เลือก"} --</option>
              {options.map((opt, i) => (
                <option key={`${opt.value}-${i}`} value={opt.value} className="bg-[#0f1629]">
                  {opt.value}{opt.label ? ` — ${opt.label}` : ""}
                </option>
              ))}
            </select>
          </div>
        );
      }

      case "textarea":
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <textarea value={value} onChange={(e) => onChange(e.target.value)}
              placeholder={f.placeholder} className={`${baseInput} min-h-[80px] resize-y`}
              required={f.required} rows={3} />
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center h-full pt-6">
            <label className="relative flex items-center cursor-pointer gap-2.5">
              <input type="checkbox" checked={value === "TRUE"} onChange={(e) => onChange(e.target.checked ? "TRUE" : "")} className="peer sr-only" />
              <div className="w-5 h-5 border-2 border-white/20 rounded-md bg-white/5 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                {value === "TRUE" && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span className="text-sm font-medium text-slate-300">{f.label}</span>
            </label>
          </div>
        );

      case "number":
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
              placeholder={f.placeholder || "0"} className={baseInput} required={f.required} step="any" />
          </div>
        );

      case "date":
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
              className={baseInput} required={f.required} />
          </div>
        );

      default:
        return (
          <div>
            <label className={baseLabel}>{f.label}{f.required && <span className="text-red-400 ml-1">*</span>}</label>
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
              placeholder={f.placeholder} className={baseInput} required={f.required} />
          </div>
        );
    }
  }

  // ── headerMap: config fieldName → raw sheet header (hook — ต้องอยู่ก่อน early return) ──
  const headerMap = useMemo<Record<string, string>>(() => {
    if (!entryHeaders.length || !formFields.length) return {};
    const map: Record<string, string> = {};
    formFields.forEach((f) => {
      const fn = f.fieldName.toLowerCase();
      const lb = f.label.toLowerCase();
      const hit = entryHeaders.find((h) => h.toLowerCase() === fn)
               ?? entryHeaders.find((h) => h.toLowerCase() === lb)
               ?? entryHeaders.find((h) => h.toLowerCase().includes(fn) || fn.includes(h.toLowerCase()))
               ?? entryHeaders.find((h) => h.toLowerCase().includes(lb) || lb.includes(h.toLowerCase()));
      if (hit) map[f.fieldName] = hit;
    });
    return map;
  }, [entryHeaders, formFields]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-orange-400 animate-spin" />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Loading</p>
        </div>
      </div>
    );
  }

  const visibleFields = formFields.filter((f) => !isPeriodField(f) && !isBranchField(f));

  // ── History table: ใช้ raw sheet headers โดยตรง ไม่ map ผ่าน config ──────────
  const HIDE_RAW_COLS = new Set([
    "period", "งวด", "เดือน", "month",
    "branch_id", "branch", "สาขา",
    "created_by", "บันทึกโดย",
    "created_at", "timestamp", "วันที่บันทึก",
  ]);
  const histColumns = entryHeaders.filter(
    (h) => h.trim() !== "" && !HIDE_RAW_COLS.has(h.toLowerCase().trim())
  );

  function isNumericVal(val: string): boolean {
    if (!val || val.trim() === "") return false;
    if (val.includes("/") || val.includes(":") || val.startsWith("http")) return false;
    return !isNaN(parseFloat(val)) && isFinite(Number(val));
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%]  w-[400px] h-[400px] rounded-full bg-amber-600/6  blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="relative z-20 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 gap-3">
            <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
            <button onClick={() => router.push("/ERP/home-demo")}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-sm font-bold text-white">{moduleTitle}</h1>
          </div>
        </div>
      </div>

      {/* ── Context Bar: Period + Branch ────────────────────────────────────── */}
      <div className="relative z-[15] bg-[#0d1222]/80 backdrop-blur-xl border-b border-white/5 sticky top-14">
        <div className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <div className="flex items-stretch gap-0 divide-x divide-white/5 h-14">

            {/* Period selector */}
            <div className="flex items-center gap-3 pr-6 flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">งวด</span>
              {periodsLoading ? (
                <div className="h-8 w-32 bg-white/5 rounded-xl animate-pulse" />
              ) : (
                <div className="flex items-center gap-1">
                  {/* ← prev */}
                  <button
                    onClick={() => { const i = periods.indexOf(period); if (i < periods.length - 1) setPeriod(periods[i + 1]); }}
                    disabled={periods.indexOf(period) >= periods.length - 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-all"
                    title="งวดก่อนหน้า"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>

                  {/* period display / select */}
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="px-3 py-1.5 text-base font-bold text-white bg-transparent border-none focus:outline-none cursor-pointer appearance-none text-center"
                    style={{ minWidth: "8rem" }}
                  >
                    {!periods.includes(period) && (
                      <option value={period} className="bg-[#0f1629] font-normal text-sm">{period}</option>
                    )}
                    {periods.map((p) => (
                      <option key={p} value={p} className="bg-[#0f1629] font-normal text-sm">{p}</option>
                    ))}
                  </select>

                  {/* → next */}
                  <button
                    onClick={() => { const i = periods.indexOf(period); if (i > 0) setPeriod(periods[i - 1]); }}
                    disabled={periods.indexOf(period) <= 0}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-25 transition-all"
                    title="งวดถัดไป"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Branch selector */}
            <div className="flex items-center gap-3 pl-6">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">สาขา</span>
              {isCentral ? (
                <select
                  value={selectedBranchName}
                  onChange={(e) => setSelectedBranchName(e.target.value)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-xl border focus:outline-none cursor-pointer transition-all ${
                    selectedBranchName
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
                  }`}
                >
                  <option value="" className="bg-[#0f1629] font-normal">⚠ เลือกสาขา</option>
                  {allBranches.map((b) => (
                    <option key={b.branchId} value={b.branchName} className="bg-[#0f1629] font-normal">{b.branchName}</option>
                  ))}
                </select>
              ) : branchName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
                  <span className="text-sm font-bold text-orange-300">{branchName}</span>
                </div>
              ) : (
                <div className="w-24 h-8 bg-white/5 rounded-xl animate-pulse" />
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">

        {/* Success */}
        {success && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-300">บันทึกสำเร็จ!</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-300">เกิดข้อผิดพลาด</p>
                <p className="text-xs text-red-400">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Auto-tracking status strip ─────────────────────────────────── */}
        <div className="mb-4 bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">

            {/* Left: status chips */}
            <div className="flex items-center gap-2 flex-wrap">

              {/* Batch auto-fee chip — แสดงระหว่างประมวลผล */}
              {batchProcessing ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
                  <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin shrink-0" />
                  ประมวลผลค่าธรรมเนียมทุกสาขา...
                </span>
              ) : batchDone ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                  ค่าธรรมเนียมอัปเดตแล้ว
                </span>
              ) : null}

              {/* Salary chip */}
              {salaryLoading ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-400">
                  <span className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  ดึงค่าจ้าง...
                </span>
              ) : salaryInfo && salaryInfo.total > 0 ? (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-300">
                  <svg className="w-3 h-3 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  ค่าจ้างพนักงาน
                  <span className="font-bold">฿{salaryInfo.total.toLocaleString("th-TH")}</span>
                  <span className="text-orange-400/60">({salaryInfo.count} คน)</span>
                </span>
              ) : null}

            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* โหลดค่าจ้าง */}
              <button
                type="button"
                title="โหลดยอดค่าจ้างจาก Payroll ใหม่"
                onClick={() => pullPayrollSalary(period, effectiveBranchId, formFields)}
                disabled={salaryLoading || !effectiveBranchId}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 rounded-xl disabled:opacity-40 transition-all"
              >
                {salaryLoading
                  ? <span className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}
                ค่าจ้าง
              </button>

              {/* รันค่าธรรมเนียมใหม่ทั้งหมด */}
              <button
                type="button"
                title="รันค่าธรรมเนียมใหม่สำหรับทุก branch × period"
                onClick={() => { batchRanRef.current = false; setBatchDone(false); runBatchAutoFee(); }}
                disabled={batchProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl disabled:opacity-40 transition-all"
              >
                {batchProcessing
                  ? <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>}
                ค่าธรรมเนียม
              </button>

              {/* ดูก่อน Append (dryRun) */}
              <button
                type="button"
                title="ดูข้อมูลที่จะ append ก่อนบันทึกจริง"
                onClick={runDryRun}
                disabled={batchProcessing || previewLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 rounded-xl disabled:opacity-40 transition-all"
              >
                {previewLoading
                  ? <span className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>}
                ดูก่อน
              </button>

              {/* ตั้งค่าธรรมเนียม → ไปหน้า settings */}
              <button
                type="button"
                title={isSuperAdmin ? "ตั้งค่า % ธรรมเนียมแต่ละช่องทาง" : "ดูค่าธรรมเนียมที่ตั้งไว้"}
                onClick={() => {
                  const params = new URLSearchParams({ spreadsheetId, histSheet: histSheetName, configName });
                  router.push(`/ERP/expense/settings?${params.toString()}`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                ตั้งค่า
              </button>
            </div>
          </div>

          {/* Fee error row */}
          {feeError && (
            <div className="px-4 py-2.5 bg-red-500/8 border-t border-red-500/20 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-red-400 flex-1">{feeError}</p>
              <button onClick={() => setFeeError(null)} className="text-red-400/60 hover:text-red-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-5">
            <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-orange-500 rounded-full" />
                <h2 className="text-sm font-bold text-white">รายละเอียดค่าใช้จ่าย</h2>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleFields.map((f) => {
                  const node = renderField(f);
                  if (!node) return null;
                  const isWide = f.type === "textarea" || f.type === "image";
                  return (
                    <div key={f.fieldName} className={isWide ? "md:col-span-2 lg:col-span-3" : ""}>
                      {node}
                    </div>
                  );
                })}
              </div>
              {visibleFields.length === 0 && (
                <p className="text-center py-8 text-slate-500 text-sm">ไม่พบ field ใน Config "{configName}"</p>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-8">
            <div className="px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {isCentral && !selectedBranchName ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    กรุณาเลือกสาขาจาก dropdown มุมขวาบนก่อนบันทึก
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-red-400">*</span> ฟิลด์ที่จำเป็นต้องกรอก
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => {
                      const blank: Record<string, string> = {};
                      formFields.forEach((f) => { blank[f.fieldName] = ""; });
                      setFormData(blank); setSalaryInfo(null);
                      pullPayrollSalary(period, effectiveBranchId, formFields);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-slate-200 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    ล้าง
                  </button>
                  <button type="submit" disabled={submitting || (isCentral && !selectedBranchName)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-400 rounded-xl hover:from-orange-600 hover:to-amber-500 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        กำลังบันทึก
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                        บันทึก
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* ── History ── */}
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-amber-500 rounded-full" />
                <h2 className="text-sm font-bold text-white">รายการที่บันทึก</h2>
                <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-400 rounded-full">
                  {entries.length} รายการ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => loadEntries(period, effectiveBranchId)}
                  disabled={entriesLoading}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40">
                  <svg className={`w-4 h-4 text-slate-400 ${entriesLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {entriesLoading ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
              <span className="text-sm text-slate-500">กำลังโหลด...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
              <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">ยังไม่มีรายการ งวด {period}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {histColumns.map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold text-slate-400 w-24">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row, ri) => (
                    <tr key={row._rowIndex}
                      className={`border-b border-white/[0.04] transition-colors ${ri % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-orange-500/5`}>
                      {histColumns.map((h) => {
                        const val = (row[h] ?? "").toString();
                        const isNum = isNumericVal(val);
                        const isImgUrl = val.startsWith("https://") && (
                          val.includes("drive.google.com") || val.includes("googleusercontent.com") ||
                          /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(val)
                        );
                        const isSlipCol = /slip|สลิป|รูป|image|photo|img/i.test(h);
                        return (
                          <td key={h} className={`px-4 py-2.5 whitespace-nowrap ${isNum ? "text-right font-medium text-orange-200" : "text-slate-300"} ${!isImgUrl && !isSlipCol ? "max-w-[200px] truncate" : ""}`}>
                            {isImgUrl ? (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-colors text-xs font-medium border border-cyan-500/20"
                                title="เปิดสลิปในแท็บใหม่"
                              >
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                ดูสลิป ↗
                              </a>
                            ) : isNum ? (
                              Number(val).toLocaleString("th-TH")
                            ) : (
                              val || <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5">
                        {deleteConfirm === row._rowIndex ? (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => handleDelete(row._rowIndex)} disabled={deleting}
                              className="px-2 py-1 text-[10px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
                              {deleting ? "..." : "ยืนยัน"}
                            </button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-1 text-[10px] font-semibold text-slate-400 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => openEdit(row)} title="แก้ไข"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            <button onClick={() => setDeleteConfirm(row._rowIndex)} title="ลบ"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </div>
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

      {/* ── Edit Modal ── */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !editSaving && setEditRow(null)} />
          <div className="relative bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-400 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">แก้ไขรายการ</h3>
              </div>
              <button onClick={() => setEditRow(null)} disabled={editSaving}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {visibleFields.map((f) => {
                if (isSalaryField(f)) return null;
                const val = editData[f.fieldName] ?? "";
                const onChange = (v: string) => setEditData((p) => ({ ...p, [f.fieldName]: v }));
                const inp = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all";

                if (f.type === "dropdown") {
                  const opts = helperOptions[f.helper!] || [];
                  return (
                    <div key={f.fieldName}>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{f.label}</label>
                      <select value={val} onChange={(e) => onChange(e.target.value)} className={`${inp} cursor-pointer`}>
                        <option value="" className="bg-[#0f1629]">-- เลือก --</option>
                        {opts.map((o, i) => <option key={i} value={o.value} className="bg-[#0f1629]">{o.value}{o.label ? ` — ${o.label}` : ""}</option>)}
                      </select>
                    </div>
                  );
                }
                if (f.type === "textarea") return (
                  <div key={f.fieldName}>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{f.label}</label>
                    <textarea value={val} onChange={(e) => onChange(e.target.value)} rows={3} className={`${inp} resize-y min-h-[72px]`} />
                  </div>
                );
                return (
                  <div key={f.fieldName}>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{f.label}</label>
                    <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={val} onChange={(e) => onChange(e.target.value)}
                      step={f.type === "number" ? "any" : undefined}
                      className={inp} />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/5">
              <button onClick={() => setEditRow(null)} disabled={editSaving}
                className="px-4 py-2 text-sm text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                ยกเลิก
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl hover:from-blue-600 hover:to-blue-500 disabled:opacity-50 transition-all">
                {editSaving
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>บันทึก...</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>บันทึก</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fee Config Modal ── */}
      {feeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !feeSaving && setFeeModalOpen(false)} />
          <div className="relative bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-400 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">ตั้งค่าธรรมเนียม &amp; VAT</h3>
                {!isSuperAdmin && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded-full">อ่านได้อย่างเดียว</span>
                )}
              </div>
              <button onClick={() => setFeeModalOpen(false)} disabled={feeSaving}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {feeConfigs.length === 0 ? (
                <div className="text-center py-8">
                  {!effectiveBranchId ? (
                    <>
                      <p className="text-slate-400 text-sm">กรุณาเลือกสาขาก่อน</p>
                      <p className="text-slate-500 text-xs mt-1">เลือกสาขาที่ต้องการตั้งค่าจาก dropdown ด้านบน</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-400 text-sm">ยังไม่มีการตั้งค่าธรรมเนียม</p>
                      <p className="text-slate-500 text-xs mt-1">ตรวจสอบว่ามี Helper_Sales_config และมี payment fields</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 mb-3">
                    {isSuperAdmin
                      ? "ตั้ง % ค่าธรรมเนียมต่อช่องทาง — VAT คิดจากยอดขายรวม"
                      : "Central เท่านั้นที่แก้ไขค่าธรรมเนียมได้"}
                  </p>
                  {feeConfigs.map((fc, idx) => (
                    <div key={fc.field_name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${fc.active ? "bg-purple-500/10 border-purple-500/30" : "bg-white/[0.02] border-white/5"}`}>
                      {/* Toggle */}
                      <button type="button"
                        onClick={() => isSuperAdmin && setFeeConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, active: !c.active } : c))}
                        disabled={!isSuperAdmin}
                        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${fc.active ? "bg-purple-500" : "bg-slate-600"} disabled:cursor-not-allowed`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${fc.active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>

                      {/* Label */}
                      <span className={`flex-1 text-sm ${fc.active ? "text-white" : "text-slate-500"}`}>
                        {fc.label}
                        {fc.field_name === "__vat__" && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded font-semibold">คิดจากยอดรวม</span>
                        )}
                      </span>

                      {/* % input */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={fc.fee_pct}
                          onChange={(e) => isSuperAdmin && setFeeConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, fee_pct: Number(e.target.value) || 0 } : c))}
                          readOnly={!isSuperAdmin}
                          disabled={!fc.active || !isSuperAdmin}
                          className="w-16 px-2 py-1 text-sm text-right bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-30 read-only:cursor-default"
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {feeError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{feeError}</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/5">
              <button onClick={() => setFeeModalOpen(false)} disabled={feeSaving}
                className="px-4 py-2 text-sm text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                {isSuperAdmin ? "ยกเลิก" : "ปิด"}
              </button>
              {isSuperAdmin && (
                <button onClick={saveFeeConfig} disabled={feeSaving || !feeConfigs.length}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-purple-400 rounded-xl hover:from-purple-600 hover:to-purple-500 disabled:opacity-50 transition-all">
                  {feeSaving
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>บันทึก...</>
                    : <>บันทึกการตั้งค่า</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Fee Preview Modal ── */}
      {feePreviewOpen && feePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !feeSaving && setFeePreviewOpen(false)} />
          <div className="relative bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-indigo-400 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">ค่าธรรมเนียม &amp; VAT</h3>
                  <p className="text-[10px] text-slate-500">งวด {period} · {isCentral ? (selectedBranchName || branchId) : (branchName || branchId)}</p>
                </div>
              </div>
              <button onClick={() => setFeePreviewOpen(false)} disabled={feeSaving}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Table */}
            <div className="p-5">
              {feePreview.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">ไม่มียอดค่าธรรมเนียมในช่วงเวลานี้</p>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/[0.04] border-b border-white/5">
                          <th className="text-left px-3 py-2.5 text-slate-400 font-semibold">ช่องทาง</th>
                          <th className="text-right px-3 py-2.5 text-slate-400 font-semibold">ยอดขาย</th>
                          <th className="text-right px-3 py-2.5 text-slate-400 font-semibold">%</th>
                          <th className="text-right px-3 py-2.5 text-slate-400 font-semibold">ค่าธรรมเนียม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feePreview.map((f) => (
                          <tr key={f.field_name} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2.5 text-white">
                              {f.label}
                              {f.type === "vat" && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded font-semibold">VAT</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-300">฿{f.sales_sum.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2.5 text-right text-slate-400">{f.fee_pct}%</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-purple-300">฿{f.fee_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-500/10 border-t border-purple-500/20">
                          <td colSpan={3} className="px-3 py-2.5 text-sm font-bold text-white">รวมทั้งหมด</td>
                          <td className="px-3 py-2.5 text-right text-sm font-bold text-purple-300">
                            ฿{feePreview.reduce((s, f) => s + f.fee_amount, 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500">* จะสร้าง {feePreview.length} รายการใน {histSheetName} วันที่สุดท้ายของเดือน</p>
                </>
              )}

              {feeError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">{feeError}</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/5">
              <button onClick={() => setFeePreviewOpen(false)} disabled={feeSaving}
                className="px-4 py-2 text-sm text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                ยกเลิก
              </button>
              {feePreview.length > 0 && (
                <button onClick={confirmFees} disabled={feeSaving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all">
                  {feeSaving
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>บันทึก...</>
                    : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>บันทึกลง Expense ({feePreview.length} รายการ)</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>

      {/* ── Preview Modal (dryRun) ──────────────────────────────────────────── */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}>
          <div className="w-full sm:max-w-3xl max-h-[90vh] bg-[#0f1629] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">ตรวจสอบก่อน Append</p>
                  <p className="text-[11px] text-slate-400">dryRun — ยังไม่ได้บันทึกจริง</p>
                </div>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {previewLoading ? (
                <div className="py-16 flex items-center justify-center">
                  <span className="w-7 h-7 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                </div>
              ) : !previewData ? (
                <p className="text-slate-500 text-sm py-8 text-center">ไม่มีข้อมูล</p>
              ) : (
                <>
                  {/* Summary chips */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full text-xs font-semibold text-emerald-400">
                      จะ append {previewData.totalSaved} แถว
                    </span>
                    {previewData.results.map((r) => (
                      <span key={`${r.date}-${r.branchId}`} className="px-3 py-1 bg-white/[0.05] border border-white/10 rounded-full text-xs text-slate-400">
                        {r.date} / {r.branchId} → {r.saved} แถว {r.skipped > 0 && `(ข้าม ${r.skipped})`}
                      </span>
                    ))}
                  </div>

                  {/* Branch matching debug */}
                  {previewData.debugInfo && (
                    <div className="bg-[#0a0f1e] border border-white/[0.06] rounded-xl p-3 text-[11px] space-y-1.5">
                      <p className="font-semibold text-slate-400 uppercase tracking-widest mb-2">Branch Mapping Debug</p>
                      {previewData.debugInfo.expDateColName && (
                        <p className="text-slate-500 mb-2">📅 วันที่อยู่ที่ col <span className="text-cyan-400 font-mono">{previewData.debugInfo.expDateColName}</span> (index {previewData.debugInfo.expDateColIdx})</p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-slate-500 mb-1">idToName (branchId → ชื่อสาขา)</p>
                          {Object.entries(previewData.debugInfo.idToNameMap).map(([id, name]) => (
                            <div key={id} className="flex gap-1 text-slate-300"><span className="text-purple-400 font-mono">{id}</span><span className="text-slate-600">→</span><span>{name || "(ว่าง)"}</span></div>
                          ))}
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">branch keys ใน Helper_Sales</p>
                          {previewData.debugInfo.dateMapBranches.map((k) => (
                            <div key={k} className={`font-mono ${previewData.debugInfo!.feeConfigBranches.some(b => b === k) ? "text-emerald-400" : Object.values(previewData.debugInfo!.idToNameMap).includes(k) ? "text-emerald-400" : "text-amber-400"}`}>
                              {k || "(ว่าง)"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* dateMap — ยอดขายรายวันที่ดึงมาได้ */}
                  {previewData.dateMap && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">ยอดขายจาก Helper_Sales (รายวัน)</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {Object.entries(previewData.dateMap)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([dateStr, branches]) => (
                          <div key={dateStr} className="bg-[#0a0f1e] border border-white/[0.06] rounded-xl p-3">
                            <p className="text-xs font-bold text-white mb-2">📅 {dateStr}</p>
                            {Object.entries(branches).map(([brKey, fields]) => (
                              <div key={brKey} className="mb-2">
                                <p className="text-[11px] text-slate-400 mb-1">🏢 {brKey || "(ไม่มี branch key)"}</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {Object.entries(fields as Record<string, number>)
                                    .filter(([, v]) => v > 0)
                                    .map(([field, val]) => (
                                      <div key={field} className="flex justify-between px-2 py-1 bg-white/[0.03] rounded-lg">
                                        <span className="text-[11px] text-slate-500 truncate">{field}</span>
                                        <span className="text-[11px] text-white font-mono ml-2">{val.toLocaleString()}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* rows ที่จะ append */}
                  {previewData.previewRows.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-widest">แถวที่จะ Append ({previewData.previewRows.length})</p>
                      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                              {["สถานะ","วันที่","งวด","สาขา","หมวด","ยอดขาย","% fee","ยอดค่าธรรมเนียม"].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.previewRows.map((r, i) => {
                              const statusCfg = {
                                append:        { label: "append",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                                skip_existing: { label: "มีแล้ว",  cls: "bg-slate-500/15  text-slate-400  border-slate-500/20"  },
                                zero_sales:    { label: "ยอด = 0", cls: "bg-red-500/15    text-red-400    border-red-500/20"    },
                                zero_pct:      { label: "% = 0",   cls: "bg-slate-500/15  text-slate-500  border-slate-500/20"  },
                              }[r.status];
                              const rowDim = r.status !== "append";
                              return (
                                <tr key={i} className={`border-b border-white/[0.04] transition-colors ${rowDim ? "opacity-40" : "hover:bg-white/[0.02]"}`}>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.cls}`}>{statusCfg.label}</span>
                                  </td>
                                  <td className="px-3 py-2 text-cyan-300 font-mono whitespace-nowrap">{r.dateStr}</td>
                                  <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap text-[10px]">{r.period}</td>
                                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{r.branchName || r.branchId}</td>
                                  <td className="px-3 py-2 text-white">{r.label}</td>
                                  <td className={`px-3 py-2 text-right font-mono ${r.salesBase === 0 ? "text-red-400" : "text-slate-300"}`}>{r.salesBase.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-right font-mono text-amber-400">{r.feePct}%</td>
                                  <td className={`px-3 py-2 text-right font-mono font-semibold ${r.amount > 0 ? "text-emerald-400" : "text-slate-600"}`}>{r.amount > 0 ? r.amount.toLocaleString() : "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-slate-400 text-sm">ไม่มีแถวใหม่ที่จะ append</p>
                      <p className="text-slate-600 text-xs mt-1">อาจมีครบทุก period แล้ว หรือยอดขาย = 0 ทุกช่อง</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {previewData && previewData.totalSaved > 0 && (
              <div className="px-5 py-4 border-t border-white/[0.07] shrink-0 flex justify-end gap-3">
                <button onClick={() => setPreviewOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                  ปิด
                </button>
                <button
                  onClick={() => {
                    setPreviewOpen(false);
                    batchRanRef.current = false;
                    setBatchDone(false);
                    runBatchAutoFee();
                  }}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 rounded-xl shadow-lg shadow-orange-500/20 transition-all"
                >
                  Append {previewData.totalSaved} แถว
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Image Lightbox ──────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Image */}
            <img
              src={lightboxUrl}
              alt="สลิปโอนเงิน"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onError={(e) => {
                // If direct image fails, show a fallback with open link
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <div className="hidden flex-col items-center gap-3 py-8 text-slate-400">
              <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">ไม่สามารถแสดงรูปโดยตรง</p>
              <a href={lightboxUrl} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm transition-colors border border-cyan-500/30">
                เปิดในแท็บใหม่ ↗
              </a>
            </div>
            {/* Open in new tab link */}
            <a href={lightboxUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              เปิดในแท็บใหม่ ↗
            </a>
          </div>
        </div>
      )}
      <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-400 animate-spin" />
      </div>
    }>
      <ExpensePage />
    </Suspense>
  );
}
