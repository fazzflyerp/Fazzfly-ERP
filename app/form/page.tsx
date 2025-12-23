"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Trash2, Plus, RefreshCw, X } from "lucide-react";
import ImageUpload from "../components/ImageUpload";

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
    repeatable?: boolean;
    notes?: string;
}

interface HelperOption {
    value: string;
    label: string;
    phone?: string;
}

export default function FormPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [helperOptions, setHelperOptions] = useState<{
        [key: string]: HelperOption[];
    }>({});

    const [customerData, setCustomerData] = useState<{ [key: string]: string }>({});
    const [lineItems, setLineItems] = useState<Array<{ [key: string]: string }>>([{}]);
    const [helperInfo, setHelperInfo] = useState<{ [key: number]: { [key: string]: HelperOption } }>({});

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const moduleId = searchParams.get("moduleId");
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName = searchParams.get("configName");
    const sheetName = searchParams.get("sheetName");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        } else if (
            status === "authenticated" &&
            moduleId &&
            spreadsheetId &&
            configName
        ) {
            fetchFormConfig();
        }
    }, [status, moduleId, spreadsheetId, configName, router]);

    const fetchFormConfig = async () => {
        try {
            setLoading(true);
            setError(null);

            const configUrl = new URL(`${window.location.origin}/api/module/config`);
            configUrl.searchParams.set("spreadsheetId", spreadsheetId!);
            configUrl.searchParams.set("configName", configName!);

            const configResponse = await fetch(configUrl.toString());

            if (!configResponse.ok) {
                const errorData = await configResponse.json();
                throw new Error(errorData.error || "Failed to fetch config");
            }

            const configData = await configResponse.json();
            const fields: FormField[] = configData.fields || [];
            setFormFields(fields);

            const helperData: { [key: string]: HelperOption[] } = {};

            for (const field of fields) {
                if (field.helper) {
                    try {
                        const helperUrl = new URL(
                            `${window.location.origin}/api/module/helpers`
                        );
                        helperUrl.searchParams.set("spreadsheetId", spreadsheetId!);
                        helperUrl.searchParams.set("helperName", field.helper);

                        const helperResponse = await fetch(helperUrl.toString());

                        if (helperResponse.ok) {
                            const helperJson = await helperResponse.json();
                            helperData[field.helper] = helperJson.options || [];
                        } else {
                            console.warn(`⚠️ Helper not found: ${field.helper} (${helperResponse.status})`);
                            helperData[field.helper] = [];
                        }
                    } catch (err) {
                        console.warn(`⚠️ Failed to fetch helper ${field.helper}:`, err);
                        helperData[field.helper] = [];
                    }
                }
            }

            setHelperOptions(helperData);
        } catch (err: any) {
            console.error("Error fetching form config:", err);
            setError(err.message || "Failed to load form");
        } finally {
            setLoading(false);
        }
    };

    const hasSection = formFields.some(f => f.section && f.section.trim() !== "");
    const customerFields = hasSection
        ? formFields.filter(f => f.section === "customer")
        : formFields;
    const lineItemFields = hasSection
        ? formFields.filter(f => f.section === "lineitem")
        : [];

    const handleCustomerChange = (fieldName: string, value: string, helperName?: string) => {
        setCustomerData(prev => ({ ...prev, [fieldName]: value }));

        if (helperName && value) {
            const helperOptions_ = helperOptions[helperName] || [];
            const found = helperOptions_.find((opt) => opt.value === value);
            if (found) {
                setHelperInfo((prev) => ({
                    ...prev,
                    0: {
                        ...(prev[0] || {}),
                        [fieldName]: found,
                    },
                }));
            }
        }
    };

    const handleLineItemChange = (fieldName: string, value: string, rowIdx: number, helperName?: string) => {
        setLineItems((prev) => {
            const newRows = [...prev];
            newRows[rowIdx] = { ...newRows[rowIdx], [fieldName]: value };
            return newRows;
        });

        if (helperName && value) {
            const helperOptions_ = helperOptions[helperName] || [];
            const found = helperOptions_.find((opt) => opt.value === value);
            if (found) {
                setHelperInfo((prev) => ({
                    ...prev,
                    [rowIdx]: {
                        ...(prev[rowIdx] || {}),
                        [fieldName]: found,
                    },
                }));
            }
        }
    };

    const addLineItem = () => {
        setLineItems((prev) => [...prev, {}]);
    };

    const deleteLineItem = (idx: number) => {
        if (lineItems.length > 1) {
            setLineItems((prev) => prev.filter((_, i) => i !== idx));
            setHelperInfo((prev) => {
                const newInfo = { ...prev };
                delete newInfo[idx];
                return newInfo;
            });
        }
    };

    const clearAll = () => {
        setCustomerData({});
        setLineItems([{}]);
        setHelperInfo({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (hasSection) {
            const missingCustomer = customerFields
                .filter((f) => f.required && !customerData[f.fieldName])
                .map((f) => f.label)
                .join(", ");

            if (missingCustomer) {
                setError(`ข้อมูลลูกค้า - โปรดกรอก: ${missingCustomer}`);
                return;
            }

            const filledItems = lineItems.filter((row) =>
                Object.values(row).some((v) => v)
            );

            if (filledItems.length === 0) {
                setError("โปรดเพิ่มสินค้าอย่างน้อย 1 รายการ");
                return;
            }

            for (let i = 0; i < filledItems.length; i++) {
                const row = filledItems[i];
                const missing = lineItemFields
                    .filter((f) => f.required && !row[f.fieldName])
                    .map((f) => f.label)
                    .join(", ");

                if (missing) {
                    setError(`สินค้าที่ ${i + 1} - โปรดกรอก: ${missing}`);
                    return;
                }
            }
        } else {
            const filledRows = lineItems.filter((row) =>
                Object.values(row).some((v) => v)
            );

            if (filledRows.length === 0) {
                setError("โปรดกรอกข้อมูลอย่างน้อย 1 รายการ");
                return;
            }

            for (let i = 0; i < filledRows.length; i++) {
                const row = filledRows[i];
                const missing = formFields
                    .filter((f) => f.required && !row[f.fieldName])
                    .map((f) => f.label)
                    .join(", ");

                if (missing) {
                    setError(`รายการที่ ${i + 1} - โปรดกรอก: ${missing}`);
                    return;
                }
            }
        }

        setSubmitting(true);

        try {
            const apiEndpoint = hasSection 
                ? "/api/module/submit-sales" 
                : "/api/module/submit-general";

            const payload = hasSection
                ? {
                    spreadsheetId,
                    sheetName,
                    formData: {
                        ...customerData,
                        lineItems: lineItems.filter((row) =>
                            Object.values(row).some((v) => v)
                        ),
                    },
                    fields: formFields,
                }
                : {
                    spreadsheetId,
                    sheetName,
                    formData: {
                        lineItems: lineItems.filter((row) =>
                            Object.values(row).some((v) => v)
                        )
                    },
                    fields: formFields,
                };

            const submitResponse = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!submitResponse.ok) {
                const errorData = await submitResponse.json();
                throw new Error(errorData.error || "Failed to submit form");
            }

            setSuccess(true);
            clearAll();

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            setTimeout(() => {
                setSuccess(false);
            }, 5000);
        } catch (err: any) {
            setError(err.message || "Failed to submit form");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center justify-center">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-200 to-indigo-200 opacity-30 animate-pulse"></div>
                            <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />
                        </div>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-blue-900 mb-2">กำลังโหลดฟอร์ม</p>
                        <p className="text-slate-500">กรุณารอสักครู่...</p>
                    </div>
                    <div className="flex gap-1 justify-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0s" }}></div>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-8" style={{ fontFamily: "'Noto Sans Thai', sans-serif" }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');
            `}</style>
            <div className="max-w-5xl mx-auto">
                <div className="mb-8 flex justify-between items-start animate-fadeInDown">
                    <div className="space-y-2">
                        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            {sheetName || configName}
                        </h1>
                    </div>
                    <button
                        onClick={() => router.push("/home")}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border border-slate-200 hover:border-blue-200 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        ย้อนกลับ
                    </button>
                </div>

                {error && (
                    <div className="mb-8 animate-slideInDown">
                        <div className="bg-red-50 border-l-4 border-red-500 rounded-2xl p-6 shadow-lg shadow-red-100/50 flex gap-4 items-start">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                            <p className="text-red-700 font-semibold flex-1">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-8 animate-slideInDown">
                        <div className="bg-green-50 border-l-4 border-green-500 rounded-2xl p-6 shadow-lg shadow-green-100/50 flex gap-4 items-start">
                            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                                <p className="text-green-700 font-semibold">บันทึกข้อมูลสำเร็จ</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {hasSection && customerFields.length > 0 && (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fadeInUp" style={{ animationDelay: "0.1s" }}>
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                    </svg>
                                    ข้อมูล
                                </h2>
                            </div>
                            <div className="p-8">
                                <div className="grid md:grid-cols-2 gap-8">
                                    {customerFields.map((field, idx) => (
                                        <div
                                            key={field.fieldName}
                                            className={`${field.type === "textarea" || field.type === "image" ? "md:col-span-2" : ""} animate-fadeInUp`}
                                            style={{ animationDelay: `${(idx + 1) * 50}ms` }}
                                        >
                                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                                {field.label}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </label>

                                            {field.type === "image" && (
                                                <ImageUpload
                                                    fieldName={field.fieldName}
                                                    label={field.label}
                                                    required={field.required}
                                                    value={customerData[field.fieldName] || ""}
                                                    onChange={(url) => handleCustomerChange(field.fieldName, url)}
                                                />
                                            )}

                                            {field.type === "dropdown" && field.helper && (
                                                <select
                                                    value={customerData[field.fieldName] || ""}
                                                    onChange={(e) => handleCustomerChange(field.fieldName, e.target.value, field.helper!)}
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300"
                                                >
                                                    <option value="">-- เลือก --</option>
                                                    {(helperOptions[field.helper] || []).map((opt) => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.value} - {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}

                                            {field.type === "text" && (
                                                <input
                                                    type="text"
                                                    placeholder={field.placeholder}
                                                    value={customerData[field.fieldName] || ""}
                                                    onChange={(e) => handleCustomerChange(field.fieldName, e.target.value)}
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300 placeholder:text-slate-400"
                                                />
                                            )}

                                            {field.type === "date" && (
                                                <input
                                                    type="date"
                                                    value={customerData[field.fieldName] || ""}
                                                    onChange={(e) => handleCustomerChange(field.fieldName, e.target.value)}
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300"
                                                />
                                            )}

                                            {field.type === "checkbox" && (
                                                <input
                                                    type="checkbox"
                                                    checked={customerData[field.fieldName] === "TRUE"}
                                                    onChange={(e) => handleCustomerChange(field.fieldName, e.target.checked ? "TRUE" : "")}
                                                    className="w-5 h-5 rounded-lg border-2 border-slate-300 accent-blue-600 cursor-pointer"
                                                />
                                            )}

                                            {field.type === "textarea" && (
                                                <textarea
                                                    placeholder={field.placeholder}
                                                    value={customerData[field.fieldName] || ""}
                                                    onChange={(e) => handleCustomerChange(field.fieldName, e.target.value)}
                                                    rows={4}
                                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300 placeholder:text-slate-400 resize-none"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {(lineItemFields.length > 0 || (!hasSection && formFields.length > 0)) && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-0.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l0.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-0.9-2-2-2z" />
                                    </svg>
                                    รายการ
                                </h2>
                                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                    {lineItems.length} รายการ
                                </span>
                            </div>

                            {lineItems.map((row, idx) => (
                                <div
                                    key={idx}
                                    className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-fadeInUp"
                                    style={{ animationDelay: `${(idx + 1) * 100}ms` }}
                                >
                                    <div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-6 flex justify-between items-center">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                            </svg>
                                            รายการที่ {idx + 1}
                                        </h3>
                                        {lineItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => deleteLineItem(idx)}
                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-300 font-semibold text-sm flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                ลบ
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-8">
                                        <div className="grid md:grid-cols-2 gap-8">
                                            {(lineItemFields.length > 0 ? lineItemFields : formFields).map((field, fieldIdx) => (
                                                <div
                                                    key={field.fieldName}
                                                    className={`${field.type === "textarea" || field.type === "image" ? "md:col-span-2" : ""} animate-fadeInUp`}
                                                    style={{ animationDelay: `${(fieldIdx + 1) * 50}ms` }}
                                                >
                                                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                                                        {field.label}
                                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                                    </label>

                                                    {field.type === "image" && (
                                                        <ImageUpload
                                                            fieldName={field.fieldName}
                                                            label={field.label}
                                                            required={field.required}
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(url) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    url,
                                                                    idx
                                                                )
                                                            }
                                                        />
                                                    )}

                                                    {field.type === "dropdown" && field.helper && (
                                                        <select
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.value,
                                                                    idx,
                                                                    field.helper!
                                                                )
                                                            }
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300"
                                                        >
                                                            <option value="">-- เลือก --</option>
                                                            {(helperOptions[field.helper] || []).map((opt) => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.value} - {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {field.type === "text" && (
                                                        <input
                                                            type="text"
                                                            placeholder={field.placeholder}
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.value,
                                                                    idx
                                                                )
                                                            }
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300 placeholder:text-slate-400"
                                                        />
                                                    )}

                                                    {field.type === "date" && (
                                                        <input
                                                            type="date"
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.value,
                                                                    idx
                                                                )
                                                            }
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300"
                                                        />
                                                    )}

                                                    {field.type === "number" && (
                                                        <input
                                                            type="number"
                                                            placeholder={field.placeholder}
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.value,
                                                                    idx
                                                                )
                                                            }
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300 placeholder:text-slate-400"
                                                        />
                                                    )}

                                                    {field.type === "checkbox" && (
                                                        <input
                                                            type="checkbox"
                                                            checked={row[field.fieldName] === "TRUE"}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.checked ? "TRUE" : "",
                                                                    idx
                                                                )
                                                            }
                                                            className="w-5 h-5 rounded-lg border-2 border-slate-300 accent-blue-600 cursor-pointer"
                                                        />
                                                    )}

                                                    {field.type === "textarea" && (
                                                        <textarea
                                                            placeholder={field.placeholder}
                                                            value={row[field.fieldName] || ""}
                                                            onChange={(e) =>
                                                                handleLineItemChange(
                                                                    field.fieldName,
                                                                    e.target.value,
                                                                    idx
                                                                )
                                                            }
                                                            rows={4}
                                                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium transition-all bg-white hover:border-blue-300 placeholder:text-slate-400 resize-none"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={addLineItem}
                                className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl hover:shadow-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-lg animate-fadeInUp"
                            >
                                <Plus className="w-6 h-6" />
                                เพิ่มรายการใหม่
                            </button>
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-4 mt-10 animate-fadeInUp">
                        <button
                            type="button"
                            onClick={clearAll}
                            className="px-6 py-4 bg-white text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-5 h-5" />
                            ล้างทั้งหมด
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/home")}
                            className="px-6 py-4 bg-white text-slate-700 rounded-2xl hover:bg-slate-50 font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2"
                        >
                            <X className="w-5 h-5" />
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:shadow-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    บันทึกข้อมูล
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                @keyframes fadeInDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideInDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fadeInDown {
                    animation: fadeInDown 0.6s ease-out;
                }
                .animate-fadeInUp {
                    animation: fadeInUp 0.6s ease-out forwards;
                    opacity: 0;
                }
                .animate-slideInDown {
                    animation: slideInDown 0.4s ease-out;
                }
            `}</style>
        </div>
    );
}