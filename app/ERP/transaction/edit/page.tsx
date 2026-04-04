/**
 * =============================================================================
 * FILE PATH: app/ERP/transaction/edit/page.tsx
 * =============================================================================
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  helper: string | null;
  order: number;
}

interface HelperOption {
  value: string;
  label: string;
}

interface DataRow {
  rowIndex: number | string;
  data: { [key: string]: any };
  _isEditing?: boolean;
  _isNew?: boolean;
}

export default function TransactionEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const spreadsheetId = searchParams.get("spreadsheetId");
  const sheetName = searchParams.get("sheetName");
  const configName = searchParams.get("configName");
  const moduleName = searchParams.get("moduleName") || "จัดการข้อมูล";

  const [config, setConfig] = useState<ConfigField[]>([]);
  const [dataRows, setDataRows] = useState<DataRow[]>([]);
  const [helperOptions, setHelperOptions] = useState<{ [key: string]: HelperOption[] }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const accessToken = (session as any)?.accessToken;

      // Fetch config
      const configRes = await fetch(
        `/api/module/config?spreadsheetId=${spreadsheetId}&configName=${configName}&_t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!configRes.ok) throw new Error("Failed to fetch config");
      const configData = await configRes.json();
      const sortedConfig = configData.fields.sort((a: ConfigField, b: ConfigField) => a.order - b.order);
      setConfig(sortedConfig);

      // ✅ Fetch helpers สำหรับ dropdown fields
      const helpersToFetch = sortedConfig
        .filter((f: ConfigField) => f.helper && f.type === "dropdown")
        .map((f: ConfigField) => f.helper!);

      if (helpersToFetch.length > 0) {
        const helperData: { [key: string]: HelperOption[] } = {};
        
        for (const helperName of helpersToFetch) {
          try {
            const helperUrl = new URL(`${window.location.origin}/api/module/helpers`);
            helperUrl.searchParams.set("spreadsheetId", spreadsheetId!);
            helperUrl.searchParams.set("helperName", helperName);

            const helperResponse = await fetch(helperUrl.toString(), {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            });

            if (helperResponse.ok) {
              const helperJson = await helperResponse.json();
              helperData[helperName] = helperJson.options || [];
              console.log(`✅ Loaded helper: ${helperName}`, helperJson.options?.length, "options");
            } else {
              console.warn(`⚠️ Helper not found: ${helperName}`);
              helperData[helperName] = [];
            }
          } catch (err) {
            console.warn(`⚠️ Failed to fetch helper ${helperName}:`, err);
            helperData[helperName] = [];
          }
        }
        
        setHelperOptions(helperData);
      }

      // Fetch data from API
      const dataRes = await fetch(
        `/api/module/data?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!dataRes.ok) throw new Error("Failed to fetch data");
      const rawData = await dataRes.json();

      // Map data to config
      const mappedData: DataRow[] = rawData.rows.map((row: any, idx: number) => {
        const mappedRow: { [key: string]: any } = {};
        
        sortedConfig.forEach((field: ConfigField) => {
          const colIndex = field.order - 1;
          mappedRow[field.fieldName] = row[colIndex] || "";
        });

        return {
          rowIndex: idx + 2, // +2 because row 1 is header
          data: mappedRow,
          _isEditing: false,
        };
      });

      setDataRows(mappedData);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ แปลงวันที่จาก Google Sheets (dd/mm/yyyy) เป็น format สำหรับ input date (yyyy-mm-dd)
  const convertDateToInput = (dateStr: string): string => {
    if (!dateStr) return "";
    
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    return "";
  };

  // ✅ แปลงวันที่จาก input date (yyyy-mm-dd) เป็น format สำหรับ Google Sheets (dd/mm/yyyy)
  const convertDateToSheet = (dateStr: string): string => {
    if (!dateStr) return "";
    
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        return `${day}/${month}/${year}`;
      }
    }
    
    return dateStr;
  };

  const handleStartEdit = (rowIndex: number | string) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, _isEditing: true } : row
      )
    );
  };

  const handleCancelEdit = (rowIndex: number | string) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, _isEditing: false } : row
      )
    );
  };

  const handleCellChange = (rowIndex: number | string, fieldName: string, value: any) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex
          ? { ...row, data: { ...row.data, [fieldName]: value } }
          : row
      )
    );
  };

  const handleAddRow = () => {
    const newRow: DataRow = {
      rowIndex: `new-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      data: {},
      _isNew: true,
      _isEditing: true,
    };
    config.forEach((field) => { newRow.data[field.fieldName] = ""; });
    setDataRows((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = async (rowIndex: number | string) => {
    if (!confirm("ต้องการลบแถวนี้?")) return;

    try {
      const accessToken = (session as any)?.accessToken;

      // Delete from Google Sheets
      const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      
      const deleteRequest = {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: "ROWS",
                startIndex: (rowIndex as number) - 1,
                endIndex: rowIndex as number,
              },
            },
          },
        ],
      };

      await fetch(deleteUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deleteRequest),
      });

      // Remove from local state
      setDataRows((prev) => prev.filter((row) => row.rowIndex !== rowIndex));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      console.error("Delete error:", err);
      setError(err.message);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const accessToken = (session as any)?.accessToken;

      // Prepare data for API
      const updates = dataRows.map((row) => {
        const rowData: any[] = [];
        config.forEach((field) => {
          const colIndex = field.order - 1;
          rowData[colIndex] = row.data[field.fieldName] || "";
        });
        return {
          rowIndex: typeof row.rowIndex === "string" && row.rowIndex.startsWith("new-") ? -1 : row.rowIndex,
          data: rowData,
          isNew: row._isNew || false,
        };
      });

      if (updates.length === 0) {
        setError("ไม่มีข้อมูลที่ต้องบันทึก");
        return;
      }

      const response = await fetch("/api/module/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          spreadsheetId,
          sheetName,
          updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save");
      }

      // Turn off editing mode
      setDataRows((prev) =>
        prev.map((row) => ({ ...row, _isEditing: false }))
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = dataRows.filter((row) => {
    if (!searchTerm) return true;
    
    return Object.values(row.data).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-full mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <QuickNavTrigger onClick={() => setNavOpen(true)} />
            <Link href="/ERP/home?tab=transaction" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="text-lg font-bold text-slate-900">{moduleName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              เพิ่มแถว
            </button>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg disabled:opacity-50 hover:bg-indigo-700 transition-all whitespace-nowrap">
              {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 py-6">
        <div className="relative mb-6">
          <input type="text" placeholder="ค้นหาข้อมูล..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400" />
          <svg className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-4 text-center font-bold text-slate-500 w-12 text-[10px] uppercase">#</th>
                  {config.map((field) => (
                    <th key={field.fieldName} className="px-3 py-4 text-left font-bold text-slate-500 uppercase tracking-tight text-[10px] min-w-[80px]">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </th>
                  ))}
                  <th className="px-3 py-4 text-center font-bold text-slate-500 w-24 text-[10px] uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <tr key={row.rowIndex} className={`hover:bg-slate-50/50 transition-colors ${row._isNew ? "bg-emerald-50/30" : row._isEditing ? "bg-indigo-50/30" : ""}`}>
                    <td className="px-2 py-4 text-center font-bold text-slate-400 text-[10px]">
                      {row._isNew ? <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">NEW</span> : idx + 1}
                    </td>
                    {config.map((field) => (
                      <td key={field.fieldName} className="px-2 py-2">
                        {row._isEditing ? (
                          field.type === "dropdown" && field.helper ? (
                            <select value={row.data[field.fieldName] || ""} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none font-bold text-[10px] text-slate-900 bg-white">
                              <option value="">-- เลือก --</option>
                              {(helperOptions[field.helper] || []).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.value} - {opt.label}</option>
                              ))}
                            </select>
                          ) : field.type === "date" ? (
                            <input type="date" value={convertDateToInput(row.data[field.fieldName] || "")} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, convertDateToSheet(e.target.value))} className="w-full p-1.5 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none font-bold text-[10px] text-slate-900 bg-white" />
                          ) : field.type === "checkbox" ? (
                            <div className="flex justify-center"><input type="checkbox" checked={row.data[field.fieldName] === "TRUE" || row.data[field.fieldName] === true} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.checked ? "TRUE" : "FALSE")} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></div>
                          ) : field.type === "number" ? (
                            <input type="number" value={row.data[field.fieldName] || ""} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none font-bold text-[10px] text-slate-900 bg-white" placeholder={field.label} />
                          ) : (
                            <textarea rows={2} value={row.data[field.fieldName] || ""} onChange={(e) => handleCellChange(row.rowIndex, field.fieldName, e.target.value)} className="w-full p-1.5 border border-slate-300 rounded-lg focus:border-indigo-500 outline-none font-bold text-[10px] text-slate-900 bg-white resize-none" placeholder={field.label} />
                          )
                        ) : (
                          <div className="font-bold text-slate-700 text-[10px] break-words leading-relaxed max-w-[200px]">
                            {field.type === "checkbox" ? (row.data[field.fieldName] === "TRUE" || row.data[field.fieldName] === true ? <span className="text-emerald-500 font-bold">✓ ใช่</span> : <span className="text-slate-300">✗ ไม่</span>) : (row.data[field.fieldName] || <span className="text-slate-200 italic font-normal">-</span>)}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => row._isEditing ? handleCancelEdit(row.rowIndex) : handleStartEdit(row.rowIndex)} className={`p-1.5 rounded-lg transition-all ${row._isEditing ? "bg-slate-200 text-slate-600" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
                          {row._isEditing ? <span className="text-[9px] font-bold">Cancel</span> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                        </button>
                        <button onClick={() => handleDeleteRow(row.rowIndex)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}