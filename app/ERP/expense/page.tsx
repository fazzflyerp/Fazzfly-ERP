"use client";

import { useEffect, useRef, useMemo, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ImageUpload from "../../components/ImageUpload";

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

  // ── Branch state ─────────────────────────────────────────────────────────────
  const [branchId,          setBranchId]          = useState<string | null>(null);
  const [branchName,        setBranchName]        = useState<string | null>(null);
  const [allBranches,       setAllBranches]       = useState<{ branchId: string; branchName: string }[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState("");
  const [branchLoaded,      setBranchLoaded]      = useState(false);
  const isCentral = branchId === "central";

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

  // ── History (entries) ─────────────────────────────────────────────────────────
  const [entries,        setEntries]        = useState<EntryRow[]>([]);
  const [entryHeaders,   setEntryHeaders]   = useState<string[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);
  const [deleting,       setDeleting]       = useState(false);
  const [autoSaving,     setAutoSaving]     = useState(false);

  // ── Edit state ────────────────────────────────────────────────────────────────
  const [editRow,    setEditRow]    = useState<EntryRow | null>(null);
  const [editData,   setEditData]   = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  // ป้องกัน auto-save ซ้ำ — key = "period|branchId|total"
  const autoSavedRef = useRef<Set<string>>(new Set());

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
      if (!res.ok) throw new Error(data.message || data.error || "Load config failed");
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
        sheetName,
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

      {/* Top Bar */}
      <div className="relative z-20 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left */}
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/ERP/home-demo")}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">{moduleTitle}</h1>
                <p className="text-xs text-slate-500">{configName}</p>
              </div>
            </div>

            {/* Right: period dropdown + branch */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Period dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:block">งวด</span>
                {periodsLoading ? (
                  <div className="w-28 h-8 bg-orange-500/10 border border-orange-500/20 rounded-xl animate-pulse" />
                ) : periods.length > 0 ? (
                  <select value={period} onChange={(e) => setPeriod(e.target.value)}
                    className="w-28 px-3 py-1.5 text-sm bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-xl focus:outline-none focus:border-orange-400/50 cursor-pointer">
                    {/* Include current period even if not in list */}
                    {!periods.includes(period) && (
                      <option value={period} className="bg-[#0f1629]">{period}</option>
                    )}
                    {periods.map((p) => (
                      <option key={p} value={p} className="bg-[#0f1629]">{p}</option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={period} onChange={(e) => setPeriod(e.target.value)}
                    placeholder="MM/YYYY"
                    className="w-24 px-3 py-1.5 text-sm bg-orange-500/10 border border-orange-500/20 text-orange-300 rounded-xl focus:outline-none focus:border-orange-400/50" />
                )}
              </div>

              {/* Branch */}
              {isCentral ? (
                <select value={selectedBranchName} onChange={(e) => setSelectedBranchName(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-orange-500/30 rounded-xl bg-orange-500/10 text-orange-300 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer">
                  <option value="" className="bg-[#0f1629]">-- เลือกสาขา --</option>
                  {allBranches.map((b) => (
                    <option key={b.branchId} value={b.branchName} className="bg-[#0f1629]">{b.branchName}</option>
                  ))}
                </select>
              ) : branchName ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-sm font-semibold text-orange-300">{branchName}</span>
                </div>
              ) : null}
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

        {/* Salary banner */}
        {salaryInfo && salaryInfo.total > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-xs text-orange-300">
              ค่าจ้างพนักงานจาก Payroll
              <span className="font-bold ml-1">฿{salaryInfo.total.toLocaleString("th-TH")}</span>
              <span className="text-orange-400/70 ml-1">({salaryInfo.count} คน · งวด {period})</span>
            </p>
          </div>
        )}

        {/* Payroll debug + manual fetch button */}
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-600/20 rounded-xl">
          <button
            type="button"
            onClick={() => pullPayrollSalary(period, effectiveBranchId, formFields)}
            disabled={salaryLoading || !effectiveBranchId}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-500/80 hover:bg-orange-500 rounded-lg disabled:opacity-40 transition-all shrink-0"
          >
            {salaryLoading
              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />โหลด...</>
              : <>↺ โหลดค่าจ้าง</>}
          </button>
          <p className="text-[10px] font-mono text-slate-400 break-all">
            {salaryDebug
              ? salaryDebug
              : `period="${period}" branch="${effectiveBranchId}" — กดปุ่มเพื่อทดสอบ`}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-5">
            <div className="px-5 py-4 bg-white/[0.03] border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-orange-500 rounded-full" />
                <h2 className="text-sm font-bold text-white">รายละเอียดค่าใช้จ่าย</h2>
                <span className="text-xs text-slate-500 ml-auto">
                  งวด {period} · {isCentral ? (selectedBranchName || "ยังไม่ได้เลือกสาขา") : (branchName || "")}
                </span>
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
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-red-400">*</span> ฟิลด์ที่จำเป็นต้องกรอก
                </p>
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
                {autoSaving && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/20">
                    <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    บันทึกค่าจ้าง...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {period} · {isCentral ? (selectedBranchName || "ทุกสาขา") : (branchName || "")}
                </span>
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
                        return (
                          <td key={h} className={`px-4 py-2.5 whitespace-nowrap max-w-[200px] truncate ${isNum ? "text-right font-medium text-orange-200" : "text-slate-300"}`}>
                            {isNum
                              ? Number(val).toLocaleString("th-TH")
                              : val || <span className="text-slate-600">—</span>}
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

      <style jsx>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
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
