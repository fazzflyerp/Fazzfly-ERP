/**
 * =============================================================================
 * FILE PATH: app/ERP/transaction/edit/page.tsx
 * =============================================================================
 * 
 * Transaction Edit Page - Table View
 * ✅ ปุ่มย้อนกลับไปหน้า Home
 * ✅ UI อ่านง่ายเหมือน Master Data
 * ✅ Dropdown พร้อม Helper Options
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
  rowIndex: number;
  data: { [key: string]: any };
  _isEditing?: boolean;
}

export default function TransactionEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const moduleId = searchParams.get("moduleId");
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

  const handleStartEdit = (rowIndex: number) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, _isEditing: true } : row
      )
    );
  };

  const handleCancelEdit = (rowIndex: number) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex ? { ...row, _isEditing: false } : row
      )
    );
  };

  const handleCellChange = (rowIndex: number, fieldName: string, value: any) => {
    setDataRows((prev) =>
      prev.map((row) =>
        row.rowIndex === rowIndex
          ? { ...row, data: { ...row.data, [fieldName]: value } }
          : row
      )
    );
  };

  const handleDeleteRow = async (rowIndex: number) => {
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
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
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
      const updates = dataRows
        .filter((row) => row._isEditing)
        .map((row) => {
          const rowData: any[] = [];
          
          config.forEach((field) => {
            const colIndex = field.order - 1;
            rowData[colIndex] = row.data[field.fieldName] || "";
          });

          return {
            rowIndex: row.rowIndex,
            data: rowData,
            isNew: false,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ✅ Header - ปุ่มย้อนกลับไปหน้า Home */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/ERP/home"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">{moduleName}</h1>
                  <p className="text-xs text-slate-500">จัดการข้อมูล</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    บันทึกทั้งหมด
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Alerts */}
        {success && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 rounded-lg p-4 animate-slideIn">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-semibold">บันทึกสำเร็จ!</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 ค้นหา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 text-sm font-bold text-slate-900 border-2 border-slate-900 rounded-lg focus:ring-2 focus:ring-slate-700 focus:border-slate-900 placeholder:text-slate-500 placeholder:font-semibold bg-white"
                />
                <svg className="absolute left-3 top-3 w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">
                📊 {filteredRows.length} รายการ
              </span>
            </div>
          </div>
        </div>

        {/* ✅ Table - UI อ่านง่ายเหมือน Master Data */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 w-12">
                    #
                  </th>
                  {config.map((field) => (
                    <th
                      key={field.fieldName}
                      className="px-3 py-2 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 w-32">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={`hover:bg-slate-50 transition-colors ${
                      row._isEditing ? "bg-slate-100 shadow-inner" : ""
                    }`}
                  >
                    <td className="px-3 py-1.5 text-xs text-slate-600 font-medium">
                      {row.rowIndex}
                    </td>
                    {config.map((field) => (
                      <td key={field.fieldName} className={`px-3 ${row._isEditing ? 'py-3' : 'py-1.5'} align-top`}>
                        {row._isEditing ? (
                          // ✅ Edit Mode - รองรับ Dropdown
                          field.type === "dropdown" && field.helper ? (
                            <select
                              value={row.data[field.fieldName] || ""}
                              onChange={(e) =>
                                handleCellChange(row.rowIndex, field.fieldName, e.target.value)
                              }
                              className="w-full px-2 py-1.5 text-[10px] font-semibold text-slate-900 border-2 border-slate-900 rounded focus:ring-1 focus:ring-slate-700 focus:border-slate-900 bg-white cursor-pointer"
                            >
                              <option value="">-- เลือก --</option>
                              {(helperOptions[field.helper] || []).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value} - {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "checkbox" ? (
                            <input
                              type="checkbox"
                              checked={row.data[field.fieldName] === "TRUE" || row.data[field.fieldName] === true}
                              onChange={(e) =>
                                handleCellChange(row.rowIndex, field.fieldName, e.target.checked ? "TRUE" : "FALSE")
                              }
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          ) : field.type === "date" ? (
                            <input
                              type="date"
                              value={convertDateToInput(row.data[field.fieldName] || "")}
                              onChange={(e) =>
                                handleCellChange(row.rowIndex, field.fieldName, convertDateToSheet(e.target.value))
                              }
                              className="w-full px-2 py-1.5 text-[10px] font-semibold text-slate-900 border-2 border-slate-900 rounded focus:ring-1 focus:ring-slate-700 focus:border-slate-900 bg-white"
                            />
                          ) : field.type === "number" ? (
                            <input
                              type="number"
                              value={row.data[field.fieldName] || ""}
                              onChange={(e) =>
                                handleCellChange(row.rowIndex, field.fieldName, e.target.value)
                              }
                              className="w-full px-2 py-1.5 text-[10px] font-semibold text-slate-900 border-2 border-slate-900 rounded focus:ring-1 focus:ring-slate-700 focus:border-slate-900 bg-white placeholder:text-slate-400"
                              placeholder={`ใส่${field.label}...`}
                            />
                          ) : (
                            <textarea
                              value={row.data[field.fieldName] || ""}
                              onChange={(e) =>
                                handleCellChange(row.rowIndex, field.fieldName, e.target.value)
                              }
                              rows={3}
                              className="w-full px-2 py-1.5 text-[10px] leading-tight font-semibold text-slate-900 border-2 border-slate-900 rounded focus:ring-1 focus:ring-slate-700 focus:border-slate-900 bg-white placeholder:text-slate-400 resize-none"
                              placeholder={`ใส่${field.label}...`}
                            />
                          )
                        ) : (
                          // ✅ Read Mode - ฟอนต์ใหญ่ อ่านง่าย
                          <div className="text-xs text-slate-800 py-1 font-medium">
                            {field.type === "checkbox" ? (
                              row.data[field.fieldName] === "TRUE" || row.data[field.fieldName] === true ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">✓ ใช่</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">✗ ไม่</span>
                              )
                            ) : (
                              row.data[field.fieldName] || <span className="text-slate-400 italic">-</span>
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-center gap-2">
                        {row._isEditing ? (
                          <button
                            onClick={() => handleCancelEdit(row.rowIndex)}
                            className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors font-medium"
                          >
                            ยกเลิก
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(row.rowIndex)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors font-medium flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            แก้ไข
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDeleteRow(row.rowIndex)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {filteredRows.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-slate-600 font-medium">ไม่พบข้อมูล</p>
              <p className="text-slate-500 text-sm mt-1">ลองค้นหาด้วยคำอื่น</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">💡 วิธีใช้งาน</p>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>แก้ไขข้อมูล:</strong> กดปุ่ม "แก้ไข" แล้วเปลี่ยนข้อมูลในช่อง</li>
                <li>• <strong>บันทึก:</strong> กดปุ่ม "บันทึกทั้งหมด" เพื่อบันทึกการเปลี่ยนแปลง</li>
                <li>• <strong>ลบ:</strong> กดปุ่มถังขยะเพื่อลบแถว</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}