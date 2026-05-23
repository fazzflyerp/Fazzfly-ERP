"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Field {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  helper: string | null;
  placeholder: string;
}

interface DataRow {
  rowIndex: number;
  data: Record<string, string>;
  rawRow: any[];
  _isEditing: boolean;
  _isNew?: boolean;
}

function toInputDate(v: string) {
  if (!v || !v.includes("/")) return v;
  const p = v.split("/");
  return p.length === 3 ? `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}` : "";
}
function toSheetDate(v: string) {
  if (!v || !v.includes("-")) return v;
  const p = v.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
}

export default function MasterDataDemoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const sp = useSearchParams();

  const spreadsheetId = sp.get("spreadsheetId") || "";
  const sheetName     = sp.get("sheetName")     || "";
  const configName    = sp.get("configName")     || "";
  const moduleName    = sp.get("moduleName")     || "จัดการข้อมูล";
  const defaultTab    = sp.get("tab") === "add" ? "add" : "edit";

  const [tab, setTab]           = useState<"add" | "edit">(defaultTab as "add" | "edit");
  const [fields, setFields]     = useState<Field[]>([]);
  const [helpers, setHelpers]   = useState<Record<string, { value: string; label: string }[]>>({});
  const [rows, setRows]         = useState<DataRow[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const loadData = useCallback(async () => {
    if (!spreadsheetId || !sheetName) return;
    setLoading(true);
    setError(null);
    try {
      // 1. อ่าน config (ถ้ามี configName) — ใช้ accessToken-based API
      let loadedFields: Field[] = [];
      if (configName) {
        const res = await fetch(`/api/master/config-demo?spreadsheetId=${spreadsheetId}&configName=${encodeURIComponent(configName)}&_t=${Date.now()}`);
        if (res.ok) {
          const d = await res.json();
          loadedFields = (d.fields || []).sort((a: Field, b: Field) => a.order - b.order);
        }
      }

      // 2. อ่าน raw rows — ใช้ accessToken-based API (SA ไม่มีสิทธิ์อ่าน client sheet)
      const dataRes = await fetch(`/api/master/data-demo?spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(sheetName)}&includeHeader=true&_t=${Date.now()}`);
      if (!dataRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
      const dataJson = await dataRes.json();
      const allRows: any[][] = dataJson.allRows || [];
      const headerRow: any[] = allRows[0] || [];
      const dataRows: any[][] = allRows.slice(1);

      // ถ้าไม่มี config → ใช้ header row เป็น field definitions
      if (loadedFields.length === 0 && headerRow.length > 0) {
        loadedFields = headerRow.map((h: any, i: number) => ({
          fieldName:   `col_${i}`,
          label:       h?.toString() || `คอลัมน์ ${i + 1}`,
          type:        "text",
          required:    false,
          order:       i + 1,
          helper:      null,
          placeholder: "",
        }));
      }

      setFields(loadedFields);

      // Map rows
      const mapped: DataRow[] = dataRows
        .filter((r) => r.some((v) => v !== undefined && v !== ""))
        .map((r, idx) => {
          const data: Record<string, string> = {};
          loadedFields.forEach((f) => {
            const colIdx = f.order - 1;
            data[f.fieldName] = (r[colIdx] ?? "").toString();
          });
          return { rowIndex: idx + 2, data, rawRow: r, _isEditing: false };
        });
      setRows(mapped);

      // Reset form
      const init: Record<string, string> = {};
      loadedFields.forEach((f) => { init[f.fieldName] = ""; });
      setFormData(init);

      // 3. โหลด helpers
      const helperFields = loadedFields.filter((f) => f.helper);
      if (helperFields.length > 0) {
        const helperRes = await fetch(
          `/api/module/helpers?spreadsheetId=${spreadsheetId}&helpers=${helperFields.map((f) => f.helper).join(",")}&_t=${Date.now()}`
        );
        if (helperRes.ok) {
          const hd = await helperRes.json();
          setHelpers(hd.helpers || {});
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, sheetName, configName]);

  useEffect(() => {
    if (status === "authenticated") loadData();
  }, [status, loadData]);

  // ── Add Form ──────────────────────────────────────────────────────────────────

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.filter((f) => f.required && !formData[f.fieldName]);
    if (missing.length) { setError(`กรุณากรอก: ${missing.map((f) => f.label).join(", ")}`); return; }

    setSubmitting(true);
    setError(null);
    try {
      // Build full row array (sparse by order index)
      const maxOrder = Math.max(...fields.map((f) => f.order));
      const rowData: any[] = new Array(maxOrder).fill("");
      fields.forEach((f) => {
        let val = formData[f.fieldName] || "";
        if (f.type === "date") val = toSheetDate(val);
        rowData[f.order - 1] = val;
      });

      const res = await fetch("/api/master/update-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spreadsheetId, sheetName,
          updates: [{ rowIndex: -1, data: rowData, isNew: true }],
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "บันทึกไม่สำเร็จ"); }

      setSuccess("เพิ่มข้อมูลสำเร็จ");
      setTimeout(() => setSuccess(null), 3000);
      const init: Record<string, string> = {};
      fields.forEach((f) => { init[f.fieldName] = ""; });
      setFormData(init);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit Table ────────────────────────────────────────────────────────────────

  const toggleEdit = (rowIndex: number) =>
    setRows((prev) => prev.map((r) => r.rowIndex === rowIndex ? { ...r, _isEditing: !r._isEditing } : r));

  const handleCellChange = (rowIndex: number, field: string, value: string) =>
    setRows((prev) => prev.map((r) => r.rowIndex === rowIndex ? { ...r, data: { ...r.data, [field]: value } } : r));

  const handleAddRow = () => {
    const init: Record<string, string> = {};
    fields.forEach((f) => { init[f.fieldName] = ""; });
    setRows((prev) => [
      ...prev,
      { rowIndex: -(Date.now()), data: init, rawRow: [], _isEditing: true, _isNew: true },
    ]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!confirm("ลบแถวนี้?")) return;
    setRows((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const updates = rows.map((row) => {
        const isNew = row._isNew || row.rowIndex < 0;
        // Build full row — patch config cols on top of rawRow
        const fullRow = isNew
          ? new Array(Math.max(...fields.map((f) => f.order))).fill("")
          : [...(row.rawRow.length > 0 ? row.rawRow : new Array(Math.max(...fields.map((f) => f.order))).fill(""))];

        fields.forEach((f) => {
          let val = row.data[f.fieldName] || "";
          if (f.type === "date" && val.includes("-")) val = toSheetDate(val);
          fullRow[f.order - 1] = val;
        });

        return { rowIndex: isNew ? -1 : row.rowIndex, data: fullRow, isNew };
      });

      const res = await fetch("/api/master/update-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId, sheetName, updates }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "บันทึกไม่สำเร็จ"); }

      setSuccess("บันทึกสำเร็จ");
      setTimeout(() => setSuccess(null), 3000);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderFormField = (field: Field) => {
    const val = formData[field.fieldName] || "";
    const cls = "w-full px-3 py-2.5 bg-[#1e2538] border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all";

    if (field.type === "select") {
      const opts = helpers[field.helper!] || [];
      return (
        <select value={val} onChange={(e) => setFormData((p) => ({ ...p, [field.fieldName]: e.target.value }))} className={cls + " cursor-pointer"} required={field.required}>
          <option value="">-- {field.placeholder || "เลือก"} --</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (field.type === "textarea") {
      return <textarea value={val} onChange={(e) => setFormData((p) => ({ ...p, [field.fieldName]: e.target.value }))} placeholder={field.placeholder} className={cls + " min-h-[80px] resize-y"} rows={3} required={field.required} />;
    }
    if (field.type === "checkbox") {
      return (
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input type="checkbox" checked={val === "TRUE"} onChange={(e) => setFormData((p) => ({ ...p, [field.fieldName]: e.target.checked ? "TRUE" : "FALSE" }))} className="w-4 h-4 rounded border-slate-500 text-indigo-500 bg-[#1e2538]" />
          <span className="text-sm text-slate-300">{field.label}</span>
        </label>
      );
    }
    return (
      <input type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        value={field.type === "date" ? toInputDate(val) : val}
        onChange={(e) => setFormData((p) => ({ ...p, [field.fieldName]: field.type === "date" ? toSheetDate(e.target.value) : e.target.value }))}
        placeholder={field.placeholder}
        className={cls}
        required={field.required}
      />
    );
  };

  const renderCellEdit = (row: DataRow, field: Field) => {
    const val = row.data[field.fieldName] || "";
    const cls = "w-full px-1.5 py-1 border border-slate-600 rounded bg-[#1e2538] text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500";
    if (field.type === "checkbox") {
      return <div className="flex justify-center"><input type="checkbox" checked={val === "TRUE"} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.checked ? "TRUE" : "FALSE")} className="w-4 h-4" /></div>;
    }
    if (field.type === "date") {
      return <input type="date" value={toInputDate(val)} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.value)} className={cls} />;
    }
    return <textarea rows={2} value={val} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.value)} className={cls + " resize-none"} />;
  };

  const filtered = rows.filter((r) => !search || Object.values(r.data).some((v) => v.toLowerCase().includes(search.toLowerCase())));

  // ── Loading / Error ───────────────────────────────────────────────────────────

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white pb-20">
      {/* Top Bar */}
      <div className="bg-[#0d1425]/90 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30">
        <div className="px-4 h-16 flex items-center gap-4">
          <Link href="/ERP/home-demo" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3zm0 5h16" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold">{moduleName}</h1>
            <p className="text-xs text-slate-500">{sheetName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/5">
          {(["edit", "add"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
                tab === t
                  ? "border-indigo-500 text-white bg-indigo-500/10"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t === "edit" ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div className="px-4 pt-4 space-y-2">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
            <button className="ml-auto" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-300 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}
      </div>

      {/* ── Tab: Add ── */}
      {tab === "add" && (
        <div className="px-4 py-6 max-w-2xl mx-auto">
          {fields.length === 0 ? (
            <div className="text-center text-slate-500 py-20">ไม่มี Config กำหนดฟิลด์ข้อมูล</div>
          ) : (
            <form onSubmit={handleAddSubmit}>
              <div className="bg-[#111827] rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-bold text-white">เพิ่มข้อมูลใหม่</h2>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.map((field) => (
                    <div key={field.fieldName} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                      {field.type !== "checkbox" && (
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                          {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                      )}
                      {renderFormField(field)}
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { const init: Record<string, string> = {}; fields.forEach((f) => { init[f.fieldName] = ""; }); setFormData(init); setError(null); }}
                    className="px-4 py-2 text-sm text-slate-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    ล้างข้อมูล
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg disabled:opacity-50 hover:from-indigo-500 hover:to-violet-500 transition-all"
                  >
                    {submitting ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Tab: Edit ── */}
      {tab === "edit" && (
        <div className="px-4 py-6">
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="ค้นหา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              เพิ่มแถว
            </button>
            <button onClick={handleSaveAll} disabled={saving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">
              {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#111827] rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0d1425] border-b border-white/10">
                  <tr>
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase w-10">#</th>
                    {fields.map((f) => (
                      <th key={f.fieldName} className="px-3 py-3 text-left text-[10px] font-bold text-slate-500 uppercase min-w-[100px]">
                        {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={fields.length + 2} className="text-center text-slate-500 py-12">ไม่มีข้อมูล</td>
                    </tr>
                  )}
                  {filtered.map((row, idx) => (
                    <tr key={row.rowIndex} className={`transition-colors hover:bg-white/2 ${row._isNew ? "bg-emerald-500/5" : row._isEditing ? "bg-indigo-500/5" : ""}`}>
                      <td className="px-2 py-3 text-center text-[10px] font-bold text-slate-500">
                        {row._isNew ? <span className="text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">NEW</span> : idx + 1}
                      </td>
                      {fields.map((field) => (
                        <td key={field.fieldName} className="px-2 py-2 min-w-[100px]">
                          {row._isEditing
                            ? renderCellEdit(row, field)
                            : (
                              <div className="text-[11px] text-slate-300 break-words max-w-[200px]">
                                {field.type === "checkbox"
                                  ? row.data[field.fieldName] === "TRUE"
                                    ? <span className="text-emerald-400">✓</span>
                                    : <span className="text-slate-600">—</span>
                                  : row.data[field.fieldName] || <span className="text-slate-600 italic">—</span>
                                }
                              </div>
                            )}
                        </td>
                      ))}
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleEdit(row.rowIndex)}
                            className={`p-1.5 rounded-lg text-[9px] font-bold transition-colors ${row._isEditing ? "bg-slate-600/40 text-slate-300" : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"}`}
                          >
                            {row._isEditing ? "ยกเลิก" : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteRow(row.rowIndex)}
                            className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-white/5 text-xs text-slate-500">
              {filtered.length} แถว {search && `(กรอง จาก ${rows.length})`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
