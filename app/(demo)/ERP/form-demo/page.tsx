"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ImageUpload from "@/app/components/ImageUpload";
import QuickNavDemo, { QuickNavDemoTrigger } from "@/app/components/QuickNavDemo";

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
}

export default function FormDemoPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [formFields, setFormFields] = useState<FormField[]>([]);
    const [helperOptions, setHelperOptions] = useState<{ [key: string]: HelperOption[] }>({});
    const [customerData, setCustomerData] = useState<{ [key: string]: string }>({});
    const [lineItems, setLineItems] = useState<Array<{ [key: string]: string }>>([{}]);
    const [helperInfo, setHelperInfo] = useState<{ [key: number]: { [key: string]: HelperOption } }>({});

    const [navOpen, setNavOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // ── Branch state ────────────────────────────────────────────────────────
    const [branchId, setBranchId] = useState<string | null>(null);
    const [branchName, setBranchName] = useState<string | null>(null);
    const [allBranches, setAllBranches] = useState<{ branchId: string; branchName: string }[]>([]);
    const [selectedBranchName, setSelectedBranchName] = useState<string>("");
    const [branchLoaded, setBranchLoaded] = useState(false);
    const isCentral = branchId === "central";

    // ── Program price presets (Sales form only) ──────────────────────────────
    const [programPresets, setProgramPresets] = useState<Record<string, { price: number; price_type: "per_unit" | "fixed" }>>({});

    // ── Price Settings Modal state ───────────────────────────────────────────
    type PresetRow = { program: string; price: string; price_type: "per_unit" | "fixed" };
    const [showPriceSettings, setShowPriceSettings] = useState(false);
    const [settingRows, setSettingRows] = useState<PresetRow[]>([]);
    const [settingSaving, setSettingSaving] = useState(false);
    const [settingMsg, setSettingMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const moduleId      = searchParams.get("moduleId");
    const spreadsheetId = searchParams.get("spreadsheetId");
    const configName    = searchParams.get("configName");
    const sheetName     = searchParams.get("sheetName");

    const isPayroll = !!(configName?.toLowerCase().includes("payroll"));
    const isSales   = !!(configName?.toLowerCase().includes("sales"));

    // ── 1. Load branch info ─────────────────────────────────────────────────
    useEffect(() => {
        if (!session) return;
        fetch("/api/auth/branch-check")
            .then((r) => r.json())
            .then((data) => {
                setBranchId(data.branchId || null);
                setBranchName(data.branchName || null);
                if (data.branchId === "central") {
                    fetch("/api/auth/branches")
                        .then((r) => r.json())
                        .then((d) => setAllBranches(d.branches || []));
                }
            })
            .catch(() => {})
            .finally(() => setBranchLoaded(true));
    }, [session]);

    // ── 2. Load form config + helpers — รอ branch-check เสร็จก่อน ──────────
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (!branchLoaded) return; // รอ branch-check
        if (status === "authenticated" && moduleId && spreadsheetId && configName) {
            fetchFormConfig();
        }
    }, [status, moduleId, spreadsheetId, configName, router, branchLoaded]);

    // ── fetch helpers แยกออกมา รับ filterBranchId ────────────────────────────
    const fetchHelpers = async (fields: FormField[], filterBranchId: string | null) => {
        const helperFields = fields.filter((f) => f.helper);
        if (helperFields.length === 0) return;

        const results = await Promise.all(
            helperFields.map(async (field) => {
                try {
                    const isLineItem = field.section === "lineitem";
                    let endpoint: string;
                    const url = new URL(window.location.origin);

                    if (isLineItem) {
                        // lineitem section → branch format (A=value, B=branch_id, C=label)
                        url.pathname = "/api/helpers-branch";
                        url.searchParams.set("spreadsheetId", spreadsheetId!);
                        url.searchParams.set("helperName", field.helper!);
                        if (filterBranchId) url.searchParams.set("branchId", filterBranchId);
                    } else {
                        // customer/other section → original format (A=value, B=label, C=detail)
                        url.pathname = "/api/module/helpers";
                        url.searchParams.set("spreadsheetId", spreadsheetId!);
                        url.searchParams.set("helperName", field.helper!);
                    }

                    const res = await fetch(url.toString());
                    const json = res.ok ? await res.json() : {};
                    return { helperName: field.helper!, options: json.options || [] };
                } catch {
                    return { helperName: field.helper!, options: [] };
                }
            })
        );

        const helperData: { [key: string]: HelperOption[] } = {};
        results.forEach(({ helperName, options }) => { helperData[helperName] = options; });
        setHelperOptions(helperData);
    };

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
                throw new Error(errorData.message || errorData.error || "Failed to fetch config");
            }

            const configData = await configResponse.json();
            const fields: FormField[] = configData.fields || [];
            setFormFields(fields);

            // central → แสดงหมดก่อน (ยังไม่ได้เลือกสาขา), branch → กรองตาม branchId
            const filterBranchId = branchId === "central" ? null : branchId;
            await fetchHelpers(fields, filterBranchId);
        } catch (err: any) {
            setError(err.message || "Failed to load form");
        } finally {
            setLoading(false);
        }
    };

    // ── central เลือกสาขา → re-fetch helpers ด้วย branchId ของสาขานั้น ─────
    useEffect(() => {
        if (!isCentral || formFields.length === 0 || !spreadsheetId) return;
        const selected = allBranches.find((b) => b.branchName === selectedBranchName);
        const filterBranchId = selected ? selected.branchId : null;
        fetchHelpers(formFields, filterBranchId);
    }, [selectedBranchName]);

    // ── Load program price presets (Sales form only) ─────────────────────────
    const loadPresets = (openSettings = false) => {
        if (!spreadsheetId) return;
        fetch(`/api/module/program-price?spreadsheetId=${encodeURIComponent(spreadsheetId)}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.presets) setProgramPresets(d.presets);
                if (openSettings) {
                    const list: PresetRow[] = (d.list || []).map((p: any) => ({
                        program: p.program,
                        price: String(p.price),
                        price_type: p.price_type === "fixed" ? "fixed" : "per_unit",
                    }));
                    setSettingRows(list.length > 0 ? list : [{ program: "", price: "", price_type: "per_unit" }]);
                    setSettingMsg(null);
                    setShowPriceSettings(true);
                }
            })
            .catch(() => {
                if (openSettings) {
                    setSettingRows([{ program: "", price: "", price_type: "per_unit" }]);
                    setSettingMsg(null);
                    setShowPriceSettings(true);
                }
            });
    };

    useEffect(() => {
        if (!isSales) return;
        loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSales, spreadsheetId]);

    // ── Save presets ──────────────────────────────────────────────────────────
    const savePresets = async () => {
        if (!spreadsheetId) return;
        setSettingSaving(true);
        setSettingMsg(null);
        try {
            const payload = settingRows
                .filter((r) => r.program.trim())
                .map((r) => ({ program: r.program.trim(), price: parseFloat(r.price) || 0, price_type: r.price_type }));
            const res = await fetch("/api/module/program-price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ spreadsheetId, presets: payload }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Save failed");
            setSettingMsg({ type: "ok", text: `บันทึกสำเร็จ ${json.count} โปรแกรม` });
            loadPresets(); // refresh preset map
        } catch (e: any) {
            setSettingMsg({ type: "err", text: e.message });
        } finally {
            setSettingSaving(false);
        }
    };

    const hasSection      = formFields.some((f) => f.section && f.section.trim() !== "");
    const customerFields  = hasSection ? formFields.filter((f) => f.section === "customer") : formFields;
    const lineItemFields  = hasSection ? formFields.filter((f) => f.section === "lineitem") : [];

    const handleCustomerChange = (fieldName: string, value: string, helperName?: string) => {
        setCustomerData((prev) => ({ ...prev, [fieldName]: value }));
        if (helperName && value) {
            const found = (helperOptions[helperName] || []).find((opt) => opt.value === value);
            if (found) setHelperInfo((prev) => ({ ...prev, 0: { ...(prev[0] || {}), [fieldName]: found } }));
        }
    };

    const handleLineItemChange = (fieldName: string, value: string, rowIdx: number, helperName?: string) => {
        setLineItems((prev) => {
            const newRows = [...prev];
            const updatedRow = { ...newRows[rowIdx], [fieldName]: value };
            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;

            // ── Program price preset auto-fill (Sales only) ──────────────────
            let presetAutoFilled = false;
            if (isSales && fieldName === "program" && value) {
                const preset = programPresets[value];
                if (preset) {
                    const qty = parseFloat(updatedRow["quantity"] || updatedRow["qty"] || "1") || 1;
                    updatedRow["price"] = preset.price_type === "per_unit"
                        ? String(preset.price * qty)
                        : String(preset.price);
                    presetAutoFilled = true;
                }
            }

            // ── Qty change → recalculate price if per_unit preset ────────────
            if (isSales && (fieldName === "quantity" || fieldName === "qty") && value) {
                const program = updatedRow["program"] || "";
                const preset = program ? programPresets[program] : undefined;
                if (preset && preset.price_type === "per_unit") {
                    updatedRow["price"] = String((preset.price) * (parseFloat(value) || 1));
                    presetAutoFilled = true;
                }
            }

            // ── Sync payment/price-type fields when price changes ─────────────
            // Triggers on: direct price input OR preset auto-fill
            const isPriceSource = allF.find(
                (f) => f.fieldName === fieldName && !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.type === "number"
            );
            if (isPriceSource || presetAutoFilled) {
                const effectivePrice = updatedRow["price"] || value;
                allF.filter((f) => isPriceTypeField(f.fieldName)).forEach((pt) => {
                    if (updatedRow[pt.fieldName]) updatedRow[pt.fieldName] = effectivePrice;
                });
                const activePayments = allF.filter((f) => isPaymentField(f.fieldName) && updatedRow[f.fieldName] && updatedRow[f.fieldName] !== "");
                if (activePayments.length === 1) {
                    const cur = updatedRow[activePayments[0].fieldName];
                    if (cur === "__on__" || cur === "__selected__") updatedRow[activePayments[0].fieldName] = effectivePrice;
                }
            }

            newRows[rowIdx] = updatedRow;
            return newRows;
        });
        if (helperName && value) {
            const found = (helperOptions[helperName] || []).find((opt) => opt.value === value);
            if (found) setHelperInfo((prev) => ({ ...prev, [rowIdx]: { ...(prev[rowIdx] || {}), [fieldName]: found } }));
        }
    };

    const addLineItem    = () => setLineItems((prev) => [...prev, {}]);
    const deleteLineItem = (idx: number) => {
        if (lineItems.length > 1) {
            setLineItems((prev) => prev.filter((_, i) => i !== idx));
            setHelperInfo((prev) => { const n = { ...prev }; delete n[idx]; return n; });
        }
    };
    const clearAll = () => { setCustomerData({}); setLineItems([{}]); setHelperInfo({}); };

    const isPriceTypeField = (fn: string) => /^price_type_/i.test(fn);
    const isPaymentField   = (fn: string) => /^payment_/i.test(fn);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // ── Branch validation ────────────────────────────────────────────────
        const effectiveBranchName = isCentral ? selectedBranchName : branchName;
        if (!effectiveBranchName) {
            setError(isCentral ? "กรุณาเลือกสาขา" : "ไม่พบข้อมูลสาขา กรุณาติดต่อผู้ดูแล");
            return;
        }

        // ── Validation ───────────────────────────────────────────────────────
        if (hasSection) {
            const missingCustomer = customerFields
                .filter((f) => f.required && f.type !== "date" && !customerData[f.fieldName])
                .map((f) => f.label).join(", ");
            if (missingCustomer) { setError(`ข้อมูลทั่วไป - โปรดกรอก: ${missingCustomer}`); return; }

            const filledItems = lineItems.filter((row) => Object.values(row).some((v) => v));
            if (filledItems.length === 0) { setError("โปรดเพิ่มสินค้าอย่างน้อย 1 รายการ"); return; }

            for (let i = 0; i < filledItems.length; i++) {
                const missing = lineItemFields
                    .filter((f) => f.required && f.type !== "date" && !filledItems[i][f.fieldName])
                    .map((f) => f.label).join(", ");
                if (missing) { setError(`สินค้าที่ ${i + 1} - โปรดกรอก: ${missing}`); return; }
            }
        } else {
            const filledRows = lineItems.filter((row) => Object.values(row).some((v) => v));
            if (filledRows.length === 0) { setError("โปรดกรอกข้อมูลอย่างน้อย 1 รายการ"); return; }
            for (let i = 0; i < filledRows.length; i++) {
                const missing = formFields
                    .filter((f) => f.required && f.type !== "date" && !filledRows[i][f.fieldName])
                    .map((f) => f.label).join(", ");
                if (missing) { setError(`รายการที่ ${i + 1} - โปรดกรอก: ${missing}`); return; }
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                spreadsheetId,
                sheetName,
                formData: hasSection && !isPayroll
                    ? { ...customerData, lineItems: lineItems.filter((row) => Object.values(row).some((v) => v)) }
                    : { lineItems: lineItems.filter((row) => Object.values(row).some((v) => v)) },
                fields: formFields,
                branchName: effectiveBranchName,
            };

            const apiEndpoint = isPayroll ? "/api/payroll/upsert-row"
                : hasSection ? "/api/module/submit-sales-branch"
                : "/api/module/submit-general";

            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to submit");
            }

            setSuccess(true);
            clearAll();
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => setSuccess(false), 5000);
        } catch (err: any) {
            setError(err.message || "Failed to submit form");
        } finally {
            setSubmitting(false);
        }
    };

    const baseInputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all";
    const baseLabel = "block text-sm font-semibold text-slate-300 mb-1.5";

    // ── Price type group ────────────────────────────────────────────────────
    const renderPriceTypeGroup = (
        group: FormField[],
        getValue: (fn: string) => string,
        setValue: (fn: string, val: string) => void,
        allFields: FormField[] = []
    ) => {
        const isRequired = group.some((f) => f.required);
        const priceSourceField =
            group[0]?.notes ||
            allFields.find((f) => f.fieldName === "price")?.fieldName ||
            allFields.find((f) => !isPriceTypeField(f.fieldName) && f.type === "number" && (f.order ?? 0) < Math.min(...group.map((g) => g.order ?? 999)))?.fieldName || "";
        const selectedField = group.find((f) => getValue(f.fieldName) !== "");
        const selectedFieldName = selectedField?.fieldName ?? "";
        const rawDisplay = priceSourceField ? getValue(priceSourceField) : "";
        const displayAmount = rawDisplay && rawDisplay !== "__on__" && rawDisplay !== "__selected__" ? rawDisplay : "";
        const showAmount = !!(selectedFieldName && displayAmount);
        const locked = !displayAmount;

        const handleSelect = (selectedFn: string) => {
            group.forEach((g) => setValue(g.fieldName, ""));
            if (selectedFn) setValue(selectedFn, displayAmount || "__selected__");
        };

        return (
            <div key="__priceTypeGroup" className="space-y-2 bg-white/[0.03] rounded-xl p-4 border border-white/10">
                <label className={`${baseLabel} ${locked ? "opacity-40" : ""}`}>
                    ประเภทของราคา{isRequired && <span className="text-red-400 ml-1">*</span>}
                </label>
                {locked ? (
                    <div className="w-full px-3 py-2.5 bg-white/5 border border-dashed border-white/10 rounded-xl text-sm text-slate-500 text-center">กรอกจำนวนเงินก่อน</div>
                ) : (
                    <>
                        <select value={selectedFieldName} onChange={(e) => handleSelect(e.target.value)} className={`${baseInputClass} cursor-pointer`} required={isRequired}>
                            <option value="" className="bg-[#0f1629]">-- เลือกประเภทของราคา --</option>
                            {group.map((f, i) => <option key={`${f.fieldName}-${i}`} value={f.fieldName} className="bg-[#0f1629]">{f.label}</option>)}
                        </select>
                        {showAmount && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <span className="text-xs text-blue-400 font-medium">{selectedField?.label}</span>
                                <span className="text-sm font-bold text-blue-300">฿{Number(displayAmount).toLocaleString("th-TH")}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // ── Payment group ───────────────────────────────────────────────────────
    const renderPaymentGroup = (
        group: FormField[],
        getValue: (fn: string) => string,
        setValues: (updates: Record<string, string>) => void,
        allFields: FormField[] = []
    ) => {
        const selected = group.filter((f) => getValue(f.fieldName) !== "");
        const selectedNames = selected.map((f) => f.fieldName);
        const isRequired = group.some((f) => f.required);
        const priceSourceFn =
            allFields.find((f) => f.fieldName === "price")?.fieldName ||
            allFields.find((f) => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.type === "number")?.fieldName || "";
        const rawPriceVal = priceSourceFn ? getValue(priceSourceFn) : "";
        const priceVal = rawPriceVal && rawPriceVal !== "__on__" && rawPriceVal !== "__selected__" ? rawPriceVal : "";

        const togglePayment = (fieldName: string) => {
            const isOn = selectedNames.includes(fieldName);
            const updates: Record<string, string> = {};
            if (isOn) {
                updates[fieldName] = "";
            } else {
                if (selectedNames.length === 0) {
                    updates[fieldName] = priceVal || "__on__";
                } else {
                    selectedNames.forEach((prev) => {
                        const cur = getValue(prev);
                        if (cur === priceVal || cur === "__on__" || cur === "__selected__") updates[prev] = "__on__";
                    });
                    updates[fieldName] = "__on__";
                }
            }
            setValues(updates);
        };

        const paymentLocked = !priceVal;
        return (
            <div key="__paymentGroup" className="space-y-2 bg-white/[0.03] rounded-xl p-4 border border-white/10">
                <label className={`${baseLabel} ${paymentLocked ? "opacity-40" : ""}`}>
                    ช่องทางชำระ{isRequired && <span className="text-red-400 ml-1">*</span>}
                </label>
                {paymentLocked ? (
                    <div className="w-full px-3 py-2.5 bg-white/5 border border-dashed border-white/10 rounded-xl text-sm text-slate-500 text-center">กรอกจำนวนเงินก่อน</div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2">
                            {group.map((f, i) => {
                                const on = selectedNames.includes(f.fieldName);
                                return (
                                    <button key={`${f.fieldName}-${i}`} type="button" onClick={() => togglePayment(f.fieldName)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${on ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-white/5 border-white/10 text-slate-400 hover:border-blue-400/40 hover:text-blue-300"}`}>
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                        {selected.length === 1 && priceVal && getValue(selected[0].fieldName) === priceVal ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <span className="text-xs text-blue-400 font-medium">{selected[0].label}</span>
                                <span className="text-sm font-bold text-blue-300">฿{Number(priceVal).toLocaleString("th-TH")}</span>
                            </div>
                        ) : selected.length > 0 ? (
                            <div className="space-y-2">
                                {selected.map((f, i) => {
                                    const val = getValue(f.fieldName);
                                    const displayVal = val === "__on__" || val === "__selected__" ? "" : val;
                                    return (
                                        <div key={`${f.fieldName}-input-${i}`} className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-400 w-28 flex-shrink-0">{f.label}</span>
                                            <input type="number" value={displayVal} onChange={(e) => setValues({ [f.fieldName]: e.target.value })}
                                                placeholder="จำนวนเงิน" className={baseInputClass} step="any" min="0"
                                                required={isRequired && !displayVal} />
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

    // ── Render field ─────────────────────────────────────────────────────────
    // Extra context passed when rendering inside a line item (for preset badge)
    const renderField = (field: FormField, value: string, onChange: (val: string) => void, lineItemRow?: { [key: string]: string }) => {
        switch (field.type) {
            case "image":
                return (
                    <div>
                        <label className={baseLabel}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                        <ImageUpload fieldName={field.fieldName} label={field.label} required={field.required} value={value} onChange={onChange} />
                    </div>
                );
            case "dropdown": {
                const options = helperOptions[field.helper!] || [];
                return (
                    <div>
                        <label className={baseLabel}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${baseInputClass} cursor-pointer`} required={field.required}>
                            <option value="" className="bg-[#0f1629]">-- {field.placeholder || "เลือก"} --</option>
                            {options.map((opt, i) => <option key={`${opt.value}-${i}`} value={opt.value} className="bg-[#0f1629]">{opt.value} - {opt.label}</option>)}
                        </select>
                    </div>
                );
            }
            case "textarea":
                return (
                    <div>
                        <label className={baseLabel}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={`${baseInputClass} min-h-[90px] resize-y`} required={field.required} rows={3} />
                    </div>
                );
            case "checkbox":
                return (
                    <div className="flex items-center h-full pt-7">
                        <label className="relative flex items-center cursor-pointer">
                            <input type="checkbox" checked={value === "TRUE"} onChange={(e) => onChange(e.target.checked ? "TRUE" : "")} className="peer sr-only" />
                            <div className="w-5 h-5 border-2 border-white/20 rounded-md bg-white/5 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all flex items-center justify-center">
                                {value === "TRUE" && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="ml-2.5 text-sm font-medium text-slate-300">{field.label}</span>
                        </label>
                    </div>
                );
            case "number": {
                // Show preset badge on price field when auto-filled from Program_Price
                const isPriceField = field.fieldName === "price";
                const presetProgram = lineItemRow?.["program"] || "";
                const activePreset = isSales && isPriceField && presetProgram ? programPresets[presetProgram] : undefined;
                return (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className={baseLabel.replace("mb-1.5", "")}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                            {activePreset && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    {activePreset.price_type === "per_unit" ? `฿${activePreset.price.toLocaleString("th-TH")}/ครั้ง` : `฿${activePreset.price.toLocaleString("th-TH")} คงที่`}
                                </span>
                            )}
                        </div>
                        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder}
                            className={`${baseInputClass}${activePreset ? " border-amber-500/30 focus:ring-amber-500/40 focus:border-amber-500/50" : ""}`}
                            required={field.required} step="any" />
                    </div>
                );
            }
            case "date":
                return (
                    <div>
                        <label className={baseLabel}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass} required={field.required} />
                    </div>
                );
            default:
                return (
                    <div>
                        <label className={baseLabel}>{field.label}{field.required && <span className="text-red-400 ml-1">*</span>}</label>
                        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={baseInputClass} required={field.required} />
                    </div>
                );
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                        <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin" />
                    </div>
                    <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Loading</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1e] relative">

            {/* Ambient background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
            </div>

            {/* Top Bar */}
            <div className="relative z-20 bg-white/[0.02] backdrop-blur-xl border-b border-white/5 sticky top-0">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <QuickNavDemoTrigger onClick={() => setNavOpen(true)} />
                            <button onClick={() => router.push("/ERP/home-demo")}
                                className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-base font-bold text-white">{sheetName || configName}</h1>
                                    <p className="text-xs text-slate-500">Transaction Management</p>
                                </div>
                            </div>
                        </div>

                        {/* Right side: settings gear (Sales) + branch */}
                        <div className="flex items-center gap-2">
                            {isSales && (
                                <button
                                    type="button"
                                    onClick={() => loadPresets(true)}
                                    title="ตั้งค่าราคาโปรแกรม"
                                    className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-white/[0.07] hover:border-amber-500/30 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                            )}
                        {/* Branch badge / selector */}
                            {isCentral ? (
                                <select
                                    value={selectedBranchName}
                                    onChange={(e) => setSelectedBranchName(e.target.value)}
                                    className="px-3 py-1.5 text-sm border border-blue-500/30 rounded-xl bg-blue-500/10 text-blue-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                                >
                                    <option value="" className="bg-[#0f1629]">-- เลือกสาขา --</option>
                                    {allBranches.map((b) => (
                                        <option key={b.branchId} value={b.branchName} className="bg-[#0f1629]">{b.branchName}</option>
                                    ))}
                                </select>
                            ) : branchName ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-sm font-semibold text-blue-300">{branchName}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
                {success && (
                    <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 animate-slideIn">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-emerald-300">บันทึกสำเร็จ!</p>
                                <p className="text-xs text-emerald-500">ข้อมูลถูกบันทึกลงฐานข้อมูลแล้ว</p>
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 animate-slideIn">
                        <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-red-300">เกิดข้อผิดพลาด</p>
                                <p className="text-xs text-red-400">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Customer Section */}
                    {hasSection && customerFields.length > 0 && (
                        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden mb-4 sm:mb-6">
                            <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.03] border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                    <h2 className="text-sm sm:text-base font-bold text-white">ข้อมูลทั่วไป</h2>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 space-y-4">
                                {(() => {
                                    const isBottomField = (fn: string) => fn === "staff" || fn === "doctor";
                                    const regularFields = [
                                        ...customerFields.filter((f) => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && !isBottomField(f.fieldName) && !(isPayroll && f.type === "date")),
                                        ...customerFields.filter((f) => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && isBottomField(f.fieldName) && !(isPayroll && f.type === "date")),
                                    ];
                                    return regularFields.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {regularFields.map((field) => (
                                                <div key={field.fieldName} className={field.type === "textarea" || field.type === "image" ? "md:col-span-2 lg:col-span-3" : ""}>
                                                    {renderField(field, customerData[field.fieldName] || "", (val) => handleCustomerChange(field.fieldName, val, field.helper!))}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null;
                                })()}
                                {(() => {
                                    const priceGroup   = customerFields.filter((f) => isPriceTypeField(f.fieldName));
                                    const paymentGroup = customerFields.filter((f) => isPaymentField(f.fieldName));
                                    if (!priceGroup.length && !paymentGroup.length) return null;
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 border-t border-white/5">
                                            {priceGroup.length > 0 && renderPriceTypeGroup(priceGroup, (fn) => customerData[fn] || "", (fn, val) => setCustomerData((p) => ({ ...p, [fn]: val })), customerFields)}
                                            {paymentGroup.length > 0 && renderPaymentGroup(paymentGroup, (fn) => customerData[fn] || "", (updates) => setCustomerData((p) => ({ ...p, ...updates })), customerFields)}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Line Items */}
                    {(lineItemFields.length > 0 || (!hasSection && formFields.length > 0)) && (
                        <div className="space-y-4">
                            {lineItems.map((row, idx) => (
                                <div key={idx} className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                                    <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-6 bg-blue-500 rounded-full" />
                                            <h2 className="text-sm sm:text-base font-bold text-white">รายการที่ {idx + 1}</h2>
                                        </div>
                                        {lineItems.length > 1 && (
                                            <button type="button" onClick={() => deleteLineItem(idx)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 sm:p-6 space-y-4">
                                        {(() => {
                                            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
                                            const regularFields = [
                                                ...allF.filter((f) => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && f.fieldName !== "staff" && f.fieldName !== "doctor" && !(isPayroll && f.type === "date")),
                                                ...allF.filter((f) => !isPriceTypeField(f.fieldName) && !isPaymentField(f.fieldName) && (f.fieldName === "staff" || f.fieldName === "doctor") && !(isPayroll && f.type === "date")),
                                            ];
                                            return regularFields.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                    {regularFields.map((field) => (
                                                        <div key={field.fieldName} className={field.type === "textarea" || field.type === "image" ? "md:col-span-2 lg:col-span-3" : ""}>
                                                            {renderField(field, row[field.fieldName] || "", (val) => handleLineItemChange(field.fieldName, val, idx, field.helper!), row)}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
                                        {(() => {
                                            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
                                            const priceGroup   = allF.filter((f) => isPriceTypeField(f.fieldName));
                                            const paymentGroup = allF.filter((f) => isPaymentField(f.fieldName));
                                            if (!priceGroup.length && !paymentGroup.length) return null;
                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 border-t border-white/5">
                                                    {priceGroup.length > 0 && renderPriceTypeGroup(priceGroup, (fn) => row[fn] || "", (fn, val) => handleLineItemChange(fn, val, idx), allF)}
                                                    {paymentGroup.length > 0 && renderPaymentGroup(paymentGroup, (fn) => row[fn] || "", (updates) => setLineItems((prev) => { const next = [...prev]; next[idx] = { ...next[idx], ...updates }; return next; }), allF)}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}

                            <button type="button" onClick={addLineItem}
                                className="w-full px-4 py-3 text-sm font-semibold text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 border-2 border-dashed border-blue-500/30 hover:border-blue-500/50 rounded-xl transition-all">
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>เพิ่มรายการใหม่</span>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 sm:mt-6 bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.02]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <span className="text-red-400">*</span>
                                    <span>ฟิลด์ที่จำเป็นต้องกรอก</span>
                                </p>
                                <div className="flex gap-2 sm:gap-3">
                                    <button type="button" onClick={clearAll}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-slate-200 transition-all">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>ล้าง</span>
                                    </button>
                                    <button type="submit" disabled={submitting}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                                        {submitting ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>กำลังบันทึก</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* ── Price Settings Modal ─────────────────────────────────────── */}
            {showPriceSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-[#0f1629] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-white">ตั้งค่าราคาโปรแกรม</h2>
                                    <p className="text-[11px] text-slate-500">ราคาจะขึ้นอัตโนมัติเมื่อเลือกโปรแกรมในฟอร์ม</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPriceSettings(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Body */}
                        {(() => {
                            // หา helper options ของ field "program" จาก lineItemFields
                            const allF = lineItemFields.length > 0 ? lineItemFields : formFields;
                            const progField = allF.find((f) => f.fieldName === "program");
                            const progOptions: HelperOption[] = progField?.helper ? (helperOptions[progField.helper] || []) : [];
                            // set ของโปรแกรมที่ถูกเลือกไปแล้วใน settingRows
                            const usedPrograms = new Set(settingRows.map((r) => r.program).filter(Boolean));
                            // โปรแกรมที่ยังไม่มี preset เลย (สำหรับปุ่มเพิ่มโปรแกรม)
                            const availableToAdd = progOptions.filter((o) => !usedPrograms.has(o.value));
                            return (
                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                                    {/* Column headers */}
                                    <div className="grid grid-cols-[1fr_120px_140px_36px] gap-2 px-1">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">โปรแกรม</span>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ราคา (฿)</span>
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ประเภท</span>
                                        <span />
                                    </div>

                                    {settingRows.map((row, i) => {
                                        // options สำหรับแถวนี้ = อันนี้เอง + ที่ยังไม่ถูกใช้
                                        const rowOptions = progOptions.filter((o) => o.value === row.program || !usedPrograms.has(o.value));
                                        return (
                                            <div key={i} className="grid grid-cols-[1fr_120px_140px_36px] gap-2 items-center">
                                                {progOptions.length > 0 ? (
                                                    <select
                                                        value={row.program}
                                                        onChange={(e) => setSettingRows((prev) => prev.map((r, j) => j === i ? { ...r, program: e.target.value } : r))}
                                                        className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors cursor-pointer"
                                                    >
                                                        <option value="" className="bg-[#0f1629]">-- เลือกโปรแกรม --</option>
                                                        {rowOptions.map((o) => (
                                                            <option key={o.value} value={o.value} className="bg-[#0f1629]">{o.value}{o.label && o.label !== o.value ? ` — ${o.label}` : ""}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        value={row.program}
                                                        onChange={(e) => setSettingRows((prev) => prev.map((r, j) => j === i ? { ...r, program: e.target.value } : r))}
                                                        placeholder="ชื่อโปรแกรม"
                                                        className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                                    />
                                                )}
                                                <input
                                                    type="number"
                                                    value={row.price}
                                                    onChange={(e) => setSettingRows((prev) => prev.map((r, j) => j === i ? { ...r, price: e.target.value } : r))}
                                                    placeholder="0"
                                                    min="0"
                                                    className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                                />
                                                <select
                                                    value={row.price_type}
                                                    onChange={(e) => setSettingRows((prev) => prev.map((r, j) => j === i ? { ...r, price_type: e.target.value as "per_unit" | "fixed" } : r))}
                                                    className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors cursor-pointer"
                                                >
                                                    <option value="per_unit" className="bg-[#0f1629]">× จำนวน</option>
                                                    <option value="fixed"    className="bg-[#0f1629]">คงที่</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setSettingRows((prev) => prev.filter((_, j) => j !== i))}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* ปุ่มเพิ่ม — ซ่อนถ้าครบทุกโปรแกรมแล้ว */}
                                    {(progOptions.length === 0 || availableToAdd.length > 0) && (
                                        <button
                                            type="button"
                                            onClick={() => setSettingRows((prev) => [...prev, { program: "", price: "", price_type: "per_unit" }])}
                                            className="w-full py-2 text-xs font-semibold text-amber-400 border border-dashed border-amber-500/30 rounded-xl hover:bg-amber-500/5 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            เพิ่มโปรแกรม {progOptions.length > 0 && <span className="text-amber-500/60">({availableToAdd.length} ที่เหลือ)</span>}
                                        </button>
                                    )}
                                    {progOptions.length > 0 && availableToAdd.length === 0 && settingRows.some((r) => r.program) && (
                                        <p className="text-center text-[11px] text-slate-600 py-1">ตั้งค่าครบทุกโปรแกรมแล้ว</p>
                                    )}

                                    {/* Legend */}
                                    <div className="flex gap-4 pt-1 px-1">
                                        <p className="text-[11px] text-slate-600"><span className="text-slate-400 font-semibold">× จำนวน</span> — ราคา × qty</p>
                                        <p className="text-[11px] text-slate-600"><span className="text-slate-400 font-semibold">คงที่</span> — ราคาเต็ม ไม่คูณจำนวน</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
                            {settingMsg ? (
                                <p className={`text-xs font-semibold ${settingMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                                    {settingMsg.type === "ok" ? "✓" : "✗"} {settingMsg.text}
                                </p>
                            ) : <span />}
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowPriceSettings(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-400 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                                    ปิด
                                </button>
                                <button type="button" onClick={savePresets} disabled={settingSaving}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                                    {settingSaving ? (
                                        <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>กำลังบันทึก</>
                                    ) : (
                                        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>บันทึก</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-slideIn { animation: slideIn 0.3s ease-out; }
            `}</style>
            <QuickNavDemo isOpen={navOpen} onClose={() => setNavOpen(false)} />
        </div>
    );
}
