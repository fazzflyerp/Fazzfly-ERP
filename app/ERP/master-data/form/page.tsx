//Path: app/ERP/master-data/form/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";

interface FormField {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  helper: string | null;
  order: number;
  placeholder: string;
  validation: string | null;
  section?: string;
  notes?: string;
}

interface HelperOption {
  value: string;
  label: string;
}

interface DuplicateMatch {
  rowNumber: number;
  matchedFields: { label: string; value: string }[];
}

export default function MasterDataFormPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [helperOptions, setHelperOptions] = useState<{
    [key: string]: HelperOption[];
  }>({});
  const [formData, setFormData] = useState<{ [key: string]: any }>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateMatch[] | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<{ id: string; data: string[] } | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const spreadsheetId = searchParams.get("spreadsheetId");
  const configName = searchParams.get("configName");
  const sheetName = searchParams.get("sheetName");
  const title = searchParams.get("title") || "เพิ่มข้อมูล";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && spreadsheetId && configName) {
      checkAccess();
    }
  }, [status, spreadsheetId, configName, router]);

  const checkAccess = async () => {
    try {
      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        router.push("/ERP/home");
        return;
      }

      const accessResponse = await fetch("/api/master/databases", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!accessResponse.ok) {
        router.push("/ERP/home");
        return;
      }

      const accessData = await accessResponse.json();
      if (accessData.totalDatabases === 0) {
        router.push("/ERP/home");
        return;
      }

      fetchFormConfig();
    } catch (err) {
      router.push("/ERP/home");
    }
  };

  const fetchFormConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        throw new Error("No access token");
      }

      let cleanSpreadsheetId = spreadsheetId || "";
      if (cleanSpreadsheetId.includes("/edit")) {
        cleanSpreadsheetId = cleanSpreadsheetId.split("/edit")[0];
      }
      if (cleanSpreadsheetId.includes("?")) {
        cleanSpreadsheetId = cleanSpreadsheetId.split("?")[0];
      }

      const configUrl = new URL(`${window.location.origin}/api/module/config`);
      configUrl.searchParams.set("spreadsheetId", cleanSpreadsheetId);
      configUrl.searchParams.set("configName", configName!);
      configUrl.searchParams.set("_t", Date.now().toString());

      const configResponse = await fetch(configUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
        cache: "no-store",
      });

      if (!configResponse.ok) {
        const errorData = await configResponse.json();
        throw new Error(errorData.error || "Failed to fetch config");
      }

      const configData = await configResponse.json();
      const fields: FormField[] = configData.fields || [];
      
      const sortedFields = [...fields].sort((a, b) => a.order - b.order);
      setFormFields(sortedFields);

      const initialData: { [key: string]: any } = {};
      sortedFields.forEach((field) => {
        if (field.type === "checkbox") {
          initialData[field.fieldName] = false;
        } else {
          initialData[field.fieldName] = "";
        }
      });
      setFormData(initialData);

      const helpersToFetch = sortedFields
        .filter((f) => f.helper)
        .map((f) => f.helper!);

      if (helpersToFetch.length > 0) {
        await fetchHelpers(cleanSpreadsheetId, helpersToFetch, accessToken);
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to load form");
      setLoading(false);
    }
  };

  const fetchHelpers = async (
    cleanSpreadsheetId: string,
    helpers: string[],
    accessToken: string
  ) => {
    try {
      const helperUrl = new URL(
        `${window.location.origin}/api/module/helpers`
      );
      helperUrl.searchParams.set("spreadsheetId", cleanSpreadsheetId);
      helperUrl.searchParams.set("helpers", helpers.join(","));
      helperUrl.searchParams.set("_t", Date.now().toString());

      const helperResponse = await fetch(helperUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
        cache: "no-store",
      });

      if (helperResponse.ok) {
        const helperData = await helperResponse.json();
        setHelperOptions(helperData.helpers || {});
      }
    } catch (err) {
    }
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const buildRowData = (cleanSpreadsheetId: string) => {
    const sortedForSubmit = [...formFields].sort((a, b) => a.order - b.order);
    const maxOrder = Math.max(...sortedForSubmit.map(f => f.order));
    const rowData: string[] = new Array(maxOrder).fill("");
    sortedForSubmit.forEach((field) => {
      const value = formData[field.fieldName];
      const arrayIndex = field.order - 1;
      if (field.type === "checkbox") {
        rowData[arrayIndex] = value ? "TRUE" : "FALSE";
      } else {
        rowData[arrayIndex] = value?.toString() || "";
      }
    });
    return rowData;
  };

  const checkDuplicates = async (
    cleanSpreadsheetId: string,
    rowData: string[]
  ): Promise<DuplicateMatch[]> => {
    const accessToken = (session as any)?.accessToken;
    const dataUrl = new URL(`${window.location.origin}/api/master/data`);
    dataUrl.searchParams.set("spreadsheetId", cleanSpreadsheetId);
    dataUrl.searchParams.set("sheetName", sheetName!);

    const res = await fetch(dataUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];

    const { rows } = await res.json();
    const matches: DuplicateMatch[] = [];

    (rows as string[][]).forEach((existingRow, idx) => {
      const matchedFields: { label: string; value: string }[] = [];

      formFields.forEach((field) => {
        const arrayIndex = field.order - 1;
        const newVal = rowData[arrayIndex]?.trim().toLowerCase();
        const existVal = existingRow[arrayIndex]?.trim().toLowerCase();

        if (
          newVal &&
          existVal &&
          newVal === existVal &&
          field.type !== "checkbox"
        ) {
          matchedFields.push({ label: field.label, value: rowData[arrayIndex] });
        }
      });

      // ถือว่าซ้ำเมื่อ required fields ทุกตัวตรงกัน
      const requiredFields = formFields.filter((f) => f.required);
      const requiredMatched = requiredFields.every((f) =>
        matchedFields.some((m) => m.label === f.label)
      );

      if (requiredMatched && matchedFields.length > 0) {
        matches.push({ rowNumber: idx + 2, matchedFields }); // +2 เพราะ row 1 = header
      }
    });

    return matches;
  };

  const doSubmit = async (cleanSpreadsheetId: string, rowData: string[]) => {
    const accessToken = (session as any)?.accessToken;
    if (!accessToken) throw new Error("No access token available");

    const response = await fetch("/api/master/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ spreadsheetId: cleanSpreadsheetId, sheetName, rowData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to save data");
    }
  };

  const resetForm = () => {
    const resetData: { [key: string]: any } = {};
    formFields.forEach((field) => {
      resetData[field.fieldName] = field.type === "checkbox" ? false : "";
    });
    setFormData(resetData);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missingFields = formFields
      .filter((field) => field.required && !formData[field.fieldName])
      .map((field) => field.label);

    if (missingFields.length > 0) {
      setError(`กรุณากรอก: ${missingFields.join(", ")}`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let cleanSpreadsheetId = spreadsheetId || "";
      if (cleanSpreadsheetId.includes("/edit")) {
        cleanSpreadsheetId = cleanSpreadsheetId.split("/edit")[0];
      }
      if (cleanSpreadsheetId.includes("?")) {
        cleanSpreadsheetId = cleanSpreadsheetId.split("?")[0];
      }

      const rowData = buildRowData(cleanSpreadsheetId);

      // ✅ ตรวจสอบข้อมูลซ้ำก่อนบันทึก
      const duplicates = await checkDuplicates(cleanSpreadsheetId, rowData);
      if (duplicates.length > 0) {
        setPendingSubmit({ id: cleanSpreadsheetId, data: rowData });
        setDuplicateWarning(duplicates);
        setSubmitting(false);
        return;
      }

      await doSubmit(cleanSpreadsheetId, rowData);
      setSuccess(true);
      setTimeout(resetForm, 2000);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceSubmit = async () => {
    if (!pendingSubmit) return;
    const { id, data } = pendingSubmit;
    setDuplicateWarning(null);
    setPendingSubmit(null);
    try {
      setSubmitting(true);
      setError(null);
      await doSubmit(id, data);
      setSuccess(true);
      setTimeout(resetForm, 2000);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.fieldName] || "";

    const baseInputClass =
      "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all";

    const baseLabel = "block text-sm font-semibold text-slate-700 mb-1.5";

    switch (field.type) {
      case "select":
        const options = helperOptions[field.helper!] || [];
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              className={`${baseInputClass} cursor-pointer`}
              required={field.required}
            >
              <option value="">-- {field.placeholder || "เลือก"} --</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case "textarea":
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              placeholder={field.placeholder}
              className={`${baseInputClass} min-h-[90px] resize-y`}
              required={field.required}
              rows={3}
            />
          </div>
        );

      case "checkbox":
        return (
          <div className="flex items-center h-full pt-7">
            <label className="relative flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={value === true || value === "TRUE"}
                onChange={(e) =>
                  handleInputChange(field.fieldName, e.target.checked)
                }
                className="peer sr-only"
              />
              <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                {(value === true || value === "TRUE") && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span className="ml-2.5 text-sm font-medium text-slate-700">
                {field.label}
              </span>
            </label>
          </div>
        );

      case "number":
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
              step="any"
            />
          </div>
        );

      case "date":
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              className={baseInputClass}
              required={field.required}
            />
          </div>
        );

      case "email":
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="email"
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
            />
          </div>
        );

      case "tel":
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="tel"
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
            />
          </div>
        );

      default:
        return (
          <div className="group">
            <label className={baseLabel}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(field.fieldName, e.target.value)}
              placeholder={field.placeholder}
              className={baseInputClass}
              required={field.required}
            />
          </div>
        );
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      {/* ─── Duplicate Warning Modal ─── */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setDuplicateWarning(null); setPendingSubmit(null); }}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-base">พบข้อมูลซ้ำ!</p>
                <p className="text-amber-100 text-xs">ข้อมูลนี้อาจถูกบันทึกไปแล้ว</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-3">
              {duplicateWarning.map((dup, i) => (
                <div key={i} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-amber-800 mb-2">
                    แถวที่ {dup.rowNumber} ในชีต
                  </p>
                  <div className="space-y-1">
                    {dup.matchedFields.map((f, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <span className="font-medium">{f.label}:</span>
                        <span className="text-amber-900 font-semibold">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setDuplicateWarning(null); setPendingSubmit(null); }}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleForceSubmit}
                disabled={submitting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 disabled:opacity-50 transition-all"
              >
                บันทึกต่อไป (ซ้ำได้)
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      {/* Top Bar - Modern Glass Effect */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <QuickNavTrigger onClick={() => setNavOpen(true)} />
              <Link
                href="/ERP/home?tab=masterdata"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-base font-bold text-slate-900">{title}</h1>
                  <p className="text-xs text-slate-500">Master Data Management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Alert Messages */}
        {success && (
          <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm animate-slideIn">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">บันทึกสำเร็จ!</p>
                <p className="text-xs text-emerald-700">ข้อมูลถูกบันทึกลงฐานข้อมูลแล้ว</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm animate-slideIn">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">เกิดข้อผิดพลาด</p>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card - Modern Design */}
        <form id="masterDataForm" onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Card Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                <h2 className="text-base font-bold text-slate-900">ข้อมูลพื้นฐาน</h2>
              </div>
            </div>
            
            {/* Form Grid */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {formFields.map((field) => (
                  <div
                    key={field.fieldName}
                    className={
                      field.type === "textarea"
                        ? "md:col-span-2 lg:col-span-3"
                        : ""
                    }
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-red-500">*</span>
                  <span>ฟิลด์ที่จำเป็นต้องกรอก</span>
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const resetData: { [key: string]: any } = {};
                      formFields.forEach((field) => {
                        if (field.type === "checkbox") {
                          resetData[field.fieldName] = false;
                        } else {
                          resetData[field.fieldName] = "";
                        }
                      });
                      setFormData(resetData);
                      setError(null);
                    }}
                    className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>ล้างข้อมูล</span>
                    </div>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                  >
                    {submitting ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>กำลังบันทึก</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>บันทึก</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
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