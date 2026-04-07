//path: app/ERP/form/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ImageUpload from "../../components/ImageUpload";
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
    const [navOpen, setNavOpen] = useState(false);

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
            const updatedRow = { ...newRows[rowIdx], [fieldName]: value };
            // ✅ ถ้า price field เปลี่ยน → sync ค่าเข้า price_type และ payment field ที่เลือก (เลือกเดียว)
            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
            const isPriceSource = allF.find(f => f.fieldName === fieldName && !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.type === "number");
            if (isPriceSource) {
                // sync price_type
                const priceTypeFields = allF.filter(f => isPriceTypeField(f.fieldName));
                const activePt = priceTypeFields.find(f => updatedRow[f.fieldName] && updatedRow[f.fieldName] !== "");
                if (activePt) updatedRow[activePt.fieldName] = value;
                // sync payment (ถ้าเลือกแค่อันเดียว)
                const payFields = allF.filter(f => isPaymentField(f.fieldName));
                const activePayments = payFields.filter(f => updatedRow[f.fieldName] && updatedRow[f.fieldName] !== "");
                if (activePayments.length === 1) {
                    const cur = updatedRow[activePayments[0].fieldName];
                    if (cur === "__on__" || cur === "__selected__") {
                        updatedRow[activePayments[0].fieldName] = value;
                    }
                }
            }
            newRows[rowIdx] = updatedRow;
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

    const baseInputClass =
        "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all";
    const baseLabel = "block text-sm font-semibold text-slate-700 mb-1.5";

    // ✅ fields ที่ชื่อขึ้นต้นด้วย price_type_ จะถูก group เป็น widget เดียว
    // เลือกได้แค่อันเดียวต่อ 1 รายการ
    const isPriceTypeField = (fieldName: string) => /^price_type_/i.test(fieldName);

    const renderPriceTypeGroup = (
        group: FormField[],
        getValue: (fieldName: string) => string,
        setValue: (fieldName: string, value: string) => void,
        allFields: FormField[] = []
    ) => {
        const isRequired = group.some(f => f.required);
        // หา price source field อัตโนมัติ:
        // 1. จาก notes ของ group[0] ถ้ามี
        // 2. หรือหา field ชื่อ "price" ใน allFields
        // 3. หรือหา number field ที่อยู่ก่อน price_type_ ใน allFields
        const priceSourceField = group[0]?.notes
            || allFields.find(f => f.fieldName === "price")?.fieldName
            || allFields.find(f => !isPriceTypeField(f.fieldName) && f.type === "number" && (f.order ?? 0) < Math.min(...group.map(g => g.order ?? 999)))?.fieldName
            || "";

        // หา selected type ปัจจุบัน (field ที่มีค่า)
        const selectedField = group.find(f => getValue(f.fieldName) !== "");
        const selectedFieldName = selectedField?.fieldName ?? "";

        const handleSelect = (selectedFn: string) => {
            group.forEach(g => setValue(g.fieldName, ""));
            if (!selectedFn) return;
            setValue(selectedFn, displayAmount || "__selected__");
        };

        // ค่าที่จะแสดง = ดึงจาก price source field real-time
        const rawDisplay = priceSourceField ? getValue(priceSourceField) : "";
        const displayAmount = rawDisplay && rawDisplay !== "__on__" && rawDisplay !== "__selected__" ? rawDisplay : "";
        const showAmount = !!(selectedFieldName && displayAmount);

        const locked = !displayAmount;
        return (
            <div key="__priceTypeGroup" className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className={`${baseLabel} ${locked ? "opacity-40" : ""}`}>
                    ประเภทของราคา
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {locked ? (
                    <div className="w-full px-3 py-2.5 bg-white border border-dashed border-slate-300 rounded-lg text-sm text-slate-400 text-center">
                        กรอกจำนวนเงินก่อน
                    </div>
                ) : (
                    <>
                        <select
                            value={selectedFieldName}
                            onChange={(e) => handleSelect(e.target.value)}
                            className={`${baseInputClass} cursor-pointer`}
                            required={isRequired}
                        >
                            <option value="">-- เลือกประเภทของราคา --</option>
                            {group.map((f, i) => (
                                <option key={`${f.fieldName}-${i}`} value={f.fieldName}>{f.label}</option>
                            ))}
                        </select>
                        {showAmount && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <span className="text-xs text-indigo-500 font-medium">{selectedField?.label}</span>
                                <span className="text-sm font-bold text-indigo-700">฿{Number(displayAmount).toLocaleString('th-TH')}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // ✅ fields ที่ชื่อขึ้นต้นด้วย payment_ จะถูก group เป็น multi-select widget
    const isPaymentField = (fieldName: string) => /^payment_/i.test(fieldName);

    const renderPaymentGroup = (
        group: FormField[],
        getValue: (fieldName: string) => string,
        setValues: (updates: Record<string, string>) => void,
        allFields: FormField[] = []
    ) => {
        const selected = group.filter(f => getValue(f.fieldName) !== "");
        const selectedNames = selected.map(f => f.fieldName);
        const isRequired = group.some(f => f.required);

        // หา price source — ดึงจาก price field โดยตรงเสมอ (ไม่ใช่จาก price_type)
        const priceSourceFn =
            allFields.find(f => f.fieldName === "price")?.fieldName
            || allFields.find(f => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.type === "number")?.fieldName
            || "";
        const rawPriceVal = priceSourceFn ? getValue(priceSourceFn) : "";
        const priceVal = rawPriceVal && rawPriceVal !== "__on__" && rawPriceVal !== "__selected__" ? rawPriceVal : "";

        const togglePayment = (fieldName: string) => {
            const isOn = selectedNames.includes(fieldName);
            const updates: Record<string, string> = {};
            if (isOn) {
                // ปิด → clear
                updates[fieldName] = "";
            } else {
                if (selectedNames.length === 0) {
                    // เลือกอันแรก → auto-fill จาก price
                    updates[fieldName] = priceVal || "__on__";
                } else {
                    // เลือกเพิ่ม → switch ทุกอันที่ auto-fill มาเป็น manual (__on__)
                    selectedNames.forEach(prev => {
                        const cur = getValue(prev);
                        if (cur === priceVal || cur === "__on__" || cur === "__selected__") {
                            updates[prev] = "__on__"; // ยังเลือกอยู่ แต่ให้กรอก manual
                        }
                    });
                    updates[fieldName] = "__on__";
                }
            }
            setValues(updates);
        };

        const paymentLocked = !priceVal;
        return (
            <div key="__paymentGroup" className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className={`${baseLabel} ${paymentLocked ? "opacity-40" : ""}`}>
                    ช่องทางชำระ
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {paymentLocked ? (
                    <div className="w-full px-3 py-2.5 bg-white border border-dashed border-slate-300 rounded-lg text-sm text-slate-400 text-center">
                        กรอกจำนวนเงินก่อน
                    </div>
                ) : (
                    <>
                        {/* toggle buttons */}
                        <div className="flex flex-wrap gap-2">
                            {group.map((f, i) => {
                                const on = selectedNames.includes(f.fieldName);
                                return (
                                    <button key={`${f.fieldName}-${i}`} type="button"
                                        onClick={() => togglePayment(f.fieldName)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                            on ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                               : "bg-white border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
                                        }`}
                                    >{f.label}</button>
                                );
                            })}
                        </div>
                        {/* inputs */}
                        {selected.length === 1 && priceVal && getValue(selected[0].fieldName) === priceVal ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <span className="text-xs text-indigo-500 font-medium">{selected[0].label}</span>
                                <span className="text-sm font-bold text-indigo-700">฿{Number(priceVal).toLocaleString('th-TH')}</span>
                            </div>
                        ) : selected.length > 0 ? (
                            <div className="space-y-2">
                                {selected.map((f, i) => {
                                    const val = getValue(f.fieldName);
                                    const displayVal = (val === "__on__" || val === "__selected__") ? "" : val;
                                    return (
                                        <div key={`${f.fieldName}-input-${i}`} className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-500 w-28 flex-shrink-0">{f.label}</span>
                                            <input
                                                type="number"
                                                value={displayVal}
                                                onChange={(e) => setValues({ [f.fieldName]: e.target.value })}
                                                placeholder="จำนวนเงิน"
                                                className={baseInputClass}
                                                step="any" min="0"
                                                required={isRequired && !displayVal}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        );
    };

    // ✅ Render Field Function
    const renderField = (field: FormField, value: string, onChange: (val: string) => void) => {

        switch (field.type) {
            case "image":
                return (
                    <div className="group">
                        <label className={baseLabel}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <ImageUpload
                            fieldName={field.fieldName}
                            label={field.label}
                            required={field.required}
                            value={value}
                            onChange={onChange}
                        />
                    </div>
                );

            case "dropdown":
                const options = helperOptions[field.helper!] || [];
                return (
                    <div className="group">
                        <label className={baseLabel}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className={`${baseInputClass} cursor-pointer`}
                            required={field.required}
                        >
                            <option value="">-- {field.placeholder || "เลือก"} --</option>
                            {options.map((opt, i) => (
                                <option key={`${opt.value}-${i}`} value={opt.value}>
                                    {opt.value} - {opt.label}
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
                            onChange={(e) => onChange(e.target.value)}
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
                                checked={value === "TRUE"}
                                onChange={(e) => onChange(e.target.checked ? "TRUE" : "")}
                                className="peer sr-only"
                            />
                            <div className="w-5 h-5 border-2 border-slate-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                                {value === "TRUE" && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
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
                            onChange={(e) => onChange(e.target.value)}
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
                            onChange={(e) => onChange(e.target.value)}
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
                            onChange={(e) => onChange(e.target.value)}
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
                            onChange={(e) => onChange(e.target.value)}
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
                            onChange={(e) => onChange(e.target.value)}
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
            <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
            {/* ✅ Top Bar - เหมือน Master Form */}
            <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <QuickNavTrigger onClick={() => setNavOpen(true)} />
                            <Link
                                href="/ERP/home"
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-base font-bold text-slate-900">{sheetName || configName}</h1>
                                    <p className="text-xs text-slate-500">Transaction Management</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                {/* ✅ Alert Messages - เหมือน Master Form */}
                {success && (
                    <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm animate-slideIn">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-red-900">เกิดข้อผิดพลาด</p>
                                <p className="text-xs text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* ✅ Customer Section - ถ้ามี */}
                    {hasSection && customerFields.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                                    <h2 className="text-base font-bold text-slate-900">ข้อมูลทั่วไป</h2>
                                </div>
                            </div>
                            <div className="p-6 space-y-5">
                                {/* ── Regular fields ── */}
                                {(() => {
                                    const isBottomField = (fn: string) => fn === "staff" || fn === "doctor";
                                    const regularFields = [
                                        ...customerFields.filter(f => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && !isBottomField(f.fieldName)),
                                        ...customerFields.filter(f => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && isBottomField(f.fieldName)),
                                    ];
                                    return regularFields.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {regularFields.map(field => (
                                                <div key={field.fieldName} className={field.type === "textarea" || field.type === "image" ? "md:col-span-2 lg:col-span-3" : ""}>
                                                    {renderField(field, customerData[field.fieldName] || "", (val) => handleCustomerChange(field.fieldName, val, field.helper!))}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null;
                                })()}
                                {/* ── ประเภทของราคา + ช่องทางชำระ ── */}
                                {(() => {
                                    const priceGroup = customerFields.filter(f => isPriceTypeField(f.fieldName));
                                    const paymentGroup = customerFields.filter(f => isPaymentField(f.fieldName));
                                    if (priceGroup.length === 0 && paymentGroup.length === 0) return null;
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 border-t border-slate-100">
                                            {priceGroup.length > 0 && renderPriceTypeGroup(priceGroup, (fn) => customerData[fn] || "", (fn, val) => setCustomerData(prev => ({ ...prev, [fn]: val })), customerFields)}
                                            {paymentGroup.length > 0 && renderPaymentGroup(paymentGroup, (fn) => customerData[fn] || "", (updates) => setCustomerData(prev => ({ ...prev, ...updates })), customerFields)}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ✅ Line Items Section */}
                    {(lineItemFields.length > 0 || (!hasSection && formFields.length > 0)) && (
                        <div className="space-y-4">
                            {lineItems.map((row, idx) => (
                                <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                                            <h2 className="text-base font-bold text-slate-900">รายการที่ {idx + 1}</h2>
                                        </div>
                                        {lineItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => deleteLineItem(idx)}
                                                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    <span>ลบ</span>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-6 space-y-5">
                                        {/* ── Regular fields ── */}
                                        {(() => {
                                            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
                                            const regularFields = [
                                                ...allF.filter(f => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.fieldName !== "staff" && f.fieldName !== "doctor"),
                                                ...allF.filter(f => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && (f.fieldName === "staff" || f.fieldName === "doctor")),
                                            ];
                                            return regularFields.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                    {regularFields.map(field => (
                                                        <div key={field.fieldName} className={field.type === "textarea" || field.type === "image" ? "md:col-span-2 lg:col-span-3" : ""}>
                                                            {renderField(field, row[field.fieldName] || "", (val) => handleLineItemChange(field.fieldName, val, idx, field.helper!))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
                                        {/* ── ประเภทของราคา + ช่องทางชำระ ── */}
                                        {(() => {
                                            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
                                            const priceGroup = allF.filter(f => isPriceTypeField(f.fieldName));
                                            const paymentGroup = allF.filter(f => isPaymentField(f.fieldName));
                                            if (priceGroup.length === 0 && paymentGroup.length === 0) return null;
                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 border-t border-slate-100">
                                                    {priceGroup.length > 0 && renderPriceTypeGroup(
                                                        priceGroup,
                                                        (fn) => row[fn] || "",
                                                        (fn, val) => handleLineItemChange(fn, val, idx),
                                                        allF
                                                    )}
                                                    {paymentGroup.length > 0 && renderPaymentGroup(
                                                        paymentGroup,
                                                        (fn) => row[fn] || "",
                                                        (updates) => setLineItems(prev => {
                                                            const next = [...prev];
                                                            next[idx] = { ...next[idx], ...updates };
                                                            return next;
                                                        }),
                                                        allF
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}

                            {/* ✅ Add Button */}
                            <button
                                type="button"
                                onClick={addLineItem}
                                className="w-full px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-300 rounded-lg transition-all"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>เพิ่มรายการใหม่</span>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* ✅ Action Buttons - เหมือน Master Form */}
                    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className="text-red-500">*</span>
                                    <span>ฟิลด์ที่จำเป็นต้องกรอก</span>
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={clearAll}
                                        className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
                                    >
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>กำลังบันทึก</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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