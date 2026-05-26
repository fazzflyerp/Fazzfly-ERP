"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  helper: string | null;
  order: number;
  section?: string;
}
interface HelperOption { value: string; label: string; }
interface DataRow {
  rowIndex: number;
  rawRow: any[];
  data: Record<string, string>;
  branchName: string;
  _editing: boolean;
  _editData: Record<string, string>;
}

const BRANCH_COL = 32; // col AG (0-based) — set by submit-sales-branch

const inputCls  = "w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-violet-500/50 transition-all";
const selectCls = "w-full bg-[#0d1526] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-violet-500/50 transition-all";

function toInputDate(s: string): string {
  if (!s) return "";
  if (s.includes("/")) {
    const [d, m, y] = s.split("/");
    if (y && m && d) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : "";
}
function toSheetDate(s: string): string {
  if (!s) return "";
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

export default function SalesBranchEditPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId") || "";
  const configName    = searchParams.get("configName")    || "";
  const sheetName     = searchParams.get("sheetName")     || "";
  const moduleName    = searchParams.get("moduleName")    || "แก้ไขการขาย";

  const [role, setRole]               = useState("");
  const [myBranchName, setMyBranchName] = useState("");
  const [branches, setBranches]       = useState<string[]>([]);
  const [selBranch, setSelBranch]     = useState("");

  const [config, setConfig]           = useState<ConfigField[]>([]);
  const [helpers, setHelpers]         = useState<Record<string, HelperOption[]>>({});
  const [rows, setRows]               = useState<DataRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState<number | null>(null);
  const [deleting, setDeleting]       = useState<number | null>(null);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<DataRow | null>(null);

  const init = useCallback(async () => {
    if (!spreadsheetId || !configName || !sheetName) return;
    setLoading(true);
    setError("");
    try {
      const [authRes, cfgRes, dataRes] = await Promise.all([
        fetch("/api/auth/branch-check").then((r) => r.json()),
        fetch(`/api/module/config?spreadsheetId=${encodeURIComponent(spreadsheetId)}&configName=${encodeURIComponent(configName)}`).then((r) => r.json()),
        fetch(`/api/module/data?spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetName=${encodeURIComponent(sheetName)}`).then((r) => r.json()),
      ]);

      setRole(authRes.role || "");
      const bName = authRes.branchName || "";
      setMyBranchName(bName);

      const fields: ConfigField[] = (cfgRes.fields || []).sort(
        (a: ConfigField, b: ConfigField) => a.order - b.order
      );
      setConfig(fields);

      // Load helpers in parallel
      const helperFields = fields.filter((f) => f.helper && f.type === "dropdown");
      if (helperFields.length > 0) {
        const results = await Promise.all(
          helperFields.map(async (f) => {
            try {
              const res = await fetch(
                `/api/module/helpers?spreadsheetId=${encodeURIComponent(spreadsheetId)}&helperName=${encodeURIComponent(f.helper!)}`
              );
              const json = res.ok ? await res.json() : {};
              return { name: f.helper!, options: json.options || [] };
            } catch { return { name: f.helper!, options: [] }; }
          })
        );
        const hMap: Record<string, HelperOption[]> = {};
        results.forEach(({ name, options }) => { hMap[name] = options; });
        setHelpers(hMap);
      }

      const rawRows: any[][] = dataRes.rows || [];
      const mapped: DataRow[] = rawRows.map((raw, idx) => {
        const data: Record<string, string> = {};
        fields.forEach((f) => { data[f.fieldName] = (raw[f.order - 1] ?? "").toString(); });
        const branchName = (raw[BRANCH_COL] ?? "").toString();
        return { rowIndex: idx + 2, rawRow: raw, data, branchName, _editing: false, _editData: { ...data } };
      });

      // Collect unique branch names for SA
      if (authRes.role === "SUPER_ADMIN") {
        const unique = [...new Set(mapped.map((r) => r.branchName).filter(Boolean))].sort();
        setBranches(unique);
        setSelBranch((prev) => prev || unique[0] || "");
      } else {
        setSelBranch(bName);
      }

      setRows(mapped);
    } catch (e: any) { setError(e.message || "โหลดข้อมูลไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [spreadsheetId, configName, sheetName]);

  useEffect(() => { init(); }, [init]);

  const isSA = role === "SUPER_ADMIN";

  const filteredRows = rows.filter((r) => {
    const branchMatch = !selBranch || r.branchName === selBranch;
    if (!branchMatch) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return Object.values(r.data).some((v) => v.toString().toLowerCase().includes(q));
  });

  function startEdit(rowIndex: number) {
    setRows((prev) => prev.map((r) =>
      r.rowIndex === rowIndex ? { ...r, _editing: true, _editData: { ...r.data } } : r
    ));
  }
  function cancelEdit(rowIndex: number) {
    setRows((prev) => prev.map((r) =>
      r.rowIndex === rowIndex ? { ...r, _editing: false } : r
    ));
  }
  function changeCell(rowIndex: number, fieldName: string, value: string) {
    setRows((prev) => prev.map((r) =>
      r.rowIndex === rowIndex ? { ...r, _editData: { ...r._editData, [fieldName]: value } } : r
    ));
  }

  async function saveRow(row: DataRow) {
    setSaving(row.rowIndex);
    setError("");
    try {
      const fullRow = [...row.rawRow];
      while (fullRow.length <= BRANCH_COL) fullRow.push("");
      config.forEach((f) => {
        const v = row._editData[f.fieldName] ?? "";
        fullRow[f.order - 1] = f.type === "date" ? toSheetDate(v) : v;
      });

      const res = await fetch("/api/module/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          sheetName,
          updates: [{ rowIndex: row.rowIndex, data: fullRow }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");

      // Update local state
      const savedData: Record<string, string> = {};
      config.forEach((f) => { savedData[f.fieldName] = row._editData[f.fieldName] ?? ""; });
      setRows((prev) => prev.map((r) =>
        r.rowIndex === row.rowIndex
          ? { ...r, data: savedData, rawRow: fullRow, _editing: false }
          : r
      ));
    } catch (e: any) { setError(e.message); }
    finally { setSaving(null); }
  }

  async function deleteRow(row: DataRow) {
    setDeleting(row.rowIndex);
    setError("");
    try {
      // Use saBatchUpdate structural delete via a dedicated delete endpoint
      // Since we don't have one, use the entries delete pattern via module/update with isDeleted flag
      // Actually: shift remaining rows up by writing empty — use saStructuralBatchUpdate via custom API
      // For now, clear the row data (soft delete) since we don't have a structural delete API for module
      const emptyRow = new Array(Math.max(row.rawRow.length, BRANCH_COL + 1)).fill("");
      const res = await fetch("/api/module/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId,
          sheetName,
          updates: [{ rowIndex: row.rowIndex, data: emptyRow }],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ลบไม่สำเร็จ");
      setRows((prev) => prev.filter((r) => r.rowIndex !== row.rowIndex));
      setDeleteConfirm(null);
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(null); }
  }

  // Display fields — skip helper-internal fields
  const displayFields = config.filter((f) => f.type !== "hidden");

  return (
    <div className="min-h-screen bg-[#0a0f1e] relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-pink-600/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-rose-600/6 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center gap-4 px-6 py-4 border-b border-white/5 backdrop-blur-xl bg-white/[0.02]">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 flex items-center justify-center" style={{ boxShadow: "0 8px 24px rgba(236,72,153,0.35)" }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">{moduleName}</h1>
          <p className="text-slate-500 text-xs">{sheetName} · {filteredRows.length} รายการ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={init} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            รีโหลด
          </button>
        </div>
      </header>

      {/* Branch switcher (SA only) */}
      {isSA && branches.length > 0 && (
        <div className="relative z-10 border-b border-white/5 bg-white/[0.01] px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500 uppercase tracking-wider shrink-0">สาขา</span>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelBranch("")}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${selBranch === "" ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"}`}>
                ทั้งหมด
              </button>
              {branches.map((b) => (
                <button key={b} onClick={() => setSelBranch(b)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${selBranch === b ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-lg" : "bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative z-10 px-6 py-3 border-b border-white/5">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา..."
            className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-pink-500/50 transition-all"
          />
        </div>
      </div>

      <main className="relative z-10 px-6 py-4">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-pink-500/20 border-t-pink-400 animate-spin" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p className="text-slate-500 text-sm">ไม่พบข้อมูล{selBranch ? ` สาขา ${selBranch}` : ""}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <div key={row.rowIndex}
                className={`bg-white/[0.04] backdrop-blur-xl border rounded-2xl overflow-hidden transition-all ${row._editing ? "border-pink-500/30 shadow-lg shadow-pink-500/5" : "border-white/8 hover:border-white/12"}`}>

                {/* Row header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-600">#{row.rowIndex}</span>
                    {row.branchName && isSA && (
                      <span className="px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/15 text-pink-400 text-xs">{row.branchName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {row._editing ? (
                      <>
                        <button onClick={() => cancelEdit(row.rowIndex)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all">
                          ยกเลิก
                        </button>
                        <button onClick={() => saveRow(row)} disabled={saving === row.rowIndex}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-pink-500 to-rose-400 text-white hover:opacity-90 disabled:opacity-50 transition-all" style={{ boxShadow: "0 4px 12px rgba(236,72,153,0.3)" }}>
                          {saving === row.rowIndex ? (
                            <><div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> กำลังบันทึก</>
                          ) : "บันทึก"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(row.rowIndex)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all">
                          แก้ไข
                        </button>
                        {isSA && (
                          <button onClick={() => setDeleteConfirm(row)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                            ลบ
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
                  {displayFields.map((f) => {
                    const displayVal = row.data[f.fieldName] ?? "";
                    const editVal    = row._editData[f.fieldName] ?? "";
                    const opts       = f.helper ? (helpers[f.helper] || []) : [];

                    return (
                      <div key={f.fieldName}>
                        <p className="text-xs text-slate-500 mb-1">{f.label}</p>
                        {row._editing ? (
                          f.type === "dropdown" && opts.length > 0 ? (
                            <select value={editVal} onChange={(e) => changeCell(row.rowIndex, f.fieldName, e.target.value)} className={selectCls}>
                              <option value="" className="bg-[#0d1526]">— เลือก —</option>
                              {opts.map((o) => (
                                <option key={o.value} value={o.value} className="bg-[#0d1526]">{o.label || o.value}</option>
                              ))}
                            </select>
                          ) : f.type === "date" ? (
                            <input type="date" value={toInputDate(editVal)} onChange={(e) => changeCell(row.rowIndex, f.fieldName, e.target.value)} className={inputCls} />
                          ) : f.type === "number" ? (
                            <input type="number" value={editVal} onChange={(e) => changeCell(row.rowIndex, f.fieldName, e.target.value)} className={inputCls} />
                          ) : f.type === "textarea" ? (
                            <textarea value={editVal} onChange={(e) => changeCell(row.rowIndex, f.fieldName, e.target.value)} rows={2} className={inputCls + " resize-none"} />
                          ) : (
                            <input type="text" value={editVal} onChange={(e) => changeCell(row.rowIndex, f.fieldName, e.target.value)} className={inputCls} />
                          )
                        ) : (
                          <p className={`text-sm font-medium truncate ${displayVal ? "text-white" : "text-slate-600"}`}>
                            {displayVal || "—"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
            <div className="p-6 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">ยืนยันการลบ</h3>
                <p className="text-slate-400 text-sm mt-1">แถว #{deleteConfirm.rowIndex} จะถูกลบข้อมูล (เคลียร์ทุก field)</p>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} disabled={!!deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-50">
                  ยกเลิก
                </button>
                <button onClick={() => deleteRow(deleteConfirm)} disabled={!!deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50">
                  {deleting ? "กำลังลบ..." : "ลบ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
