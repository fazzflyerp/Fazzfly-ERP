/**
 * =============================================================================
 * FILE: app/ERP/payroll-slip/page.tsx
 * =============================================================================
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";
import PayrollSlipPreview from "@/app/components/PayrollSlipPreview";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  type2: string; // "P" = รับ, "N" = หัก, "" = อื่นๆ
  order: number | null;
}

interface PayrollEmployee {
  employeeId: string;
  employeeName: string;
  nickname?: string;
  position?: string;
  payPeriod: string;
  workingDays: number;
  leaveDays: number;
  lateMinutes: number;
  bankAccount?: string;
  totalIncome: number;
  totalDeduction: number;
  netSalary: number;
  rawData: any;
}

export default function PayrollSlipPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [moduleInfo, setModuleInfo] = useState<any>(null);
  const [config, setConfig] = useState<ConfigField[]>([]);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [filteredEmployees, setFilteredEmployees] = useState<PayrollEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // ✅ NEW: Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") initializeData();
  }, [status]);

  const parseNum = (val: any): number => {
    if (!val) return 0;
    const num = parseFloat(val.toString().replace(/,/g, ""));
    return isNaN(num) ? 0 : num;
  };

  const initializeData = async () => {
    try {
      setLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const moduleIdFromURL = urlParams.get("moduleId");
      const spreadsheetIdFromURL = urlParams.get("spreadsheetId");

      if (!moduleIdFromURL || !spreadsheetIdFromURL) throw new Error("Missing moduleId or spreadsheetId");

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) throw new Error("No access token");

      const userModulesRes = await fetch("/api/user/modules", { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!userModulesRes.ok) throw new Error("Failed to fetch user modules");
      const userData = await userModulesRes.json();

      const docsRes = await fetch(`/api/user/documents?clientId=${userData.clientId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!docsRes.ok) throw new Error("Failed to fetch documents");
      const docsData = await docsRes.json();

      const document = docsData.documents.find((d: any) => d.moduleId === moduleIdFromURL);
      if (!document) throw new Error("Module not found");

      setModuleInfo(document);

      const [configRes, transRes, companyRes] = await Promise.all([
        fetch(`/api/payroll/config?spreadsheetId=${document.spreadsheetId}&configName=${document.configName}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/payroll/transactions?spreadsheetId=${document.spreadsheetId}&sheetName=${document.sheetName}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store", // ✅ ไม่ cache
        }),
        fetch(`/api/payroll/company-info?spreadsheetId=${document.spreadsheetId}&sheetName=${document.companyName || "company_info"}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);

      if (!configRes.ok || !transRes.ok) throw new Error("Failed to fetch data");

      const configData = await configRes.json();
      const transData = await transRes.json();
      const companyData = companyRes.ok ? await companyRes.json() : null;

      setConfig(configData.fields);
      setCompanyInfo(companyData?.companyInfo);
      processPayrollData(configData.fields, transData.transactions);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ✅ NEW: Refresh handler — re-fetch transactions only
  const handleRefresh = async () => {
    if (!moduleInfo || refreshing) return;
    setRefreshing(true);
    try {
      const accessToken = (session as any)?.accessToken;
      const res = await fetch(
        `/api/payroll/transactions?spreadsheetId=${moduleInfo.spreadsheetId}&sheetName=${moduleInfo.sheetName}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store", // ✅ ไม่ cache — ได้ข้อมูลล่าสุดเสมอ
        }
      );
      if (res.ok) {
        const data = await res.json();
        processPayrollData(config, data.transactions);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const processPayrollData = (configFields: ConfigField[], rawTransactions: any[]) => {
    const mapTransaction = (transaction: any): any => {
      const mapped: any = {};
      configFields.forEach((field) => {
        if (field.order !== null) {
          mapped[field.fieldName] = transaction.data[field.order - 1] || "";
        }
      });
      return mapped;
    };

    const mappedData = rawTransactions.map(mapTransaction);

    const totalIncomeField   = configFields.find(f => f.fieldName === "total_income");
    const totalDeductField   = configFields.find(f => f.fieldName === "total_deduction");
    const netSalaryField     = configFields.find(f => f.fieldName === "net_salary");

    const employeeList: PayrollEmployee[] = mappedData.map((data: any) => ({
      employeeId:     data.employee_id   || "N/A",
      employeeName:   data.employee_name || "N/A",
      nickname:       data.nickname,
      position:       data.position,
      payPeriod:      data.pay_period    || "N/A",
      workingDays:    parseNum(data.working_days),
      leaveDays:      parseNum(data.leave_days),
      lateMinutes:    parseNum(data.late_minutes),
      bankAccount:    data.bank_account,
      totalIncome:    parseNum(totalIncomeField  ? data[totalIncomeField.fieldName]  : 0),
      totalDeduction: parseNum(totalDeductField  ? data[totalDeductField.fieldName]  : 0),
      netSalary:      parseNum(netSalaryField     ? data[netSalaryField.fieldName]    : 0),
      rawData:        data,
    }));

    const periods = Array.from(new Set(employeeList.map(e => e.payPeriod)))
      .filter(p => p !== "N/A")
      .sort((a, b) => b.localeCompare(a));

    setEmployees(employeeList);
    setAvailablePeriods(periods);
    if (periods.length > 0) setSelectedPeriod(prev => prev || periods[0]);
  };

  useEffect(() => {
    if (!selectedPeriod) { setFilteredEmployees([]); return; }
    let filtered = employees.filter(e => e.payPeriod === selectedPeriod);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.employeeName.toLowerCase().includes(term) ||
        e.employeeId.toLowerCase().includes(term) ||
        e.nickname?.toLowerCase().includes(term)
      );
    }
    filtered.sort((a, b) => sortOrder === 'newest'
      ? b.employeeName.localeCompare(a.employeeName)
      : a.employeeName.localeCompare(b.employeeName)
    );
    setFilteredEmployees(filtered);
  }, [selectedPeriod, employees, searchTerm, sortOrder]);

  const SKIP_FIELDS = ["employee_id","employee_name","nickname","position","pay_period",
    "working_days","leave_days","late_minutes","bank_account",
    "total_income","total_deduction","net_salary"];

  const buildEarningsArray = (emp: PayrollEmployee) =>
    config
      .filter(f => f.type2 === "P" && !SKIP_FIELDS.includes(f.fieldName) && f.order !== null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(f => ({ fieldName: f.fieldName, label: f.label, amount: parseNum(emp.rawData[f.fieldName]) }))
      .filter(item => item.amount > 0);

  const buildDeductionsArray = (emp: PayrollEmployee) =>
    config
      .filter(f => f.type2 === "N" && !SKIP_FIELDS.includes(f.fieldName) && f.order !== null)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(f => ({ fieldName: f.fieldName, label: f.label, amount: parseNum(emp.rawData[f.fieldName]) }))
      .filter(item => item.amount > 0);

  const handleGeneratePDF = async (employee: PayrollEmployee) => {
    if (!companyInfo) return;
    try {
      setGenerating(true);
      const earnings   = buildEarningsArray(employee);
      const deductions = buildDeductionsArray(employee);

      const pdfData = {
        companyInfo: {
          company_name:    companyInfo.company_name    || "บริษัท ทดสอบ จำกัด",
          company_name_en: companyInfo.company_name_en,
          address:         companyInfo.address         || "123 ถนนทดสอบ",
          tel:             companyInfo.phone || companyInfo.tel || "02-123-4567",
          tax_id:          companyInfo.tax_id          || "0-0000-00000-00-0",
          logo_url:        companyInfo.logo_url,
        },
        payPeriod:      employee.payPeriod,
        employeeId:     employee.employeeId,
        employeeName:   employee.employeeName,
        nickname:       employee.nickname,
        position:       employee.position,
        workingDays:    employee.workingDays,
        leaveDays:      employee.leaveDays,
        lateMinutes:    employee.lateMinutes,
        bankAccount:    employee.bankAccount,
        earnings,
        deductions,
        totalIncome:    employee.totalIncome,
        totalDeduction: employee.totalDeduction,
        netSalary:      employee.netSalary,
      };

      const response = await fetch("/api/payroll/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfData),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      const periodParts = employee.payPeriod.trim().split(/\s+/);
      const year = periodParts[periodParts.length - 1];
      const thaiMonthsFull = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
      const thaiMonthsShort = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
      const engMonths = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      let monthNum = "01";
      const monthName = periodParts[0];
      let idx = thaiMonthsFull.indexOf(monthName);
      if (idx !== -1) monthNum = String(idx+1).padStart(2,'0');
      else { idx = thaiMonthsShort.indexOf(monthName); if (idx !== -1) monthNum = String(idx+1).padStart(2,'0');
      else { idx = engMonths.indexOf(monthName); if (idx !== -1) monthNum = String(idx+1).padStart(2,'0'); } }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${employee.employeeName}_${year}-${monthNum}.pdf`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);

      const rootFolderId = moduleInfo?.folderID;
      if (!rootFolderId) { alert("✅ ดาวน์โหลด PDF สำเร็จ! (ไม่พบ Folder ID)"); return; }

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) { alert("✅ ดาวน์โหลด PDF สำเร็จ! (ไม่มี access token)"); return; }

      const uploadFormData = new FormData();
      uploadFormData.append("file", blob, `${employee.employeeName}.pdf`);
      uploadFormData.append("employeeId", employee.employeeId);
      uploadFormData.append("employeeName", employee.employeeName);
      uploadFormData.append("payPeriod", employee.payPeriod);
      uploadFormData.append("rootFolderId", rootFolderId);

      const uploadResponse = await fetch("/api/payroll/upload-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadFormData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        alert(`✅ ดาวน์โหลดและบันทึกลง Google Drive สำเร็จ!\n📁 ${uploadData.folderPath}${uploadData.fileName}`);
      } else {
        alert("✅ ดาวน์โหลด PDF สำเร็จ! (แต่บันทึกลง Drive ไม่สำเร็จ)");
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-blue-600 font-medium text-lg">กำลังโหลด...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link href="/ERP/home" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">กลับหน้าหลัก</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Navbar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <QuickNavTrigger onClick={() => setNavOpen(true)} />
            <Link href="/ERP/home" className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
            </Link>
            <h1 className="text-sm font-bold text-slate-800 truncate">สลิปเงินเดือน</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500 font-semibold hidden sm:block">{employees.length} รายการ</span>
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-all disabled:opacity-50">
              <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "โหลด..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-col grid */}
      <div className="h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-2">

        {/* Left: Employee List */}
        <div className="flex flex-col border-r border-slate-200 overflow-hidden">
          {/* Filters */}
          <div className="flex-none px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap gap-1.5 items-center">
            <select value={selectedPeriod} onChange={(e) => { setSelectedPeriod(e.target.value); setShowPreview(false); }}
              className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[130px]">
              <option value="">-- เลือกงวด --</option>
              {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {(['newest','oldest'] as const).map(order => (
                <button key={order} onClick={() => setSortOrder(order)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortOrder === order ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {order === 'newest' ? 'A→Z' : 'Z→A'}
                </button>
              ))}
            </div>
            <input type="text" placeholder="ค้นหา..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} disabled={!selectedPeriod}
              className="flex-1 min-w-[80px] px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-40"/>
            <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">{filteredEmployees.length} คน</span>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {!selectedPeriod ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">เลือกงวดเงินเดือน</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">ไม่พบพนักงาน</div>
            ) : filteredEmployees.map(emp => {
              const isSelected = selectedEmployee?.employeeId === emp.employeeId && selectedEmployee?.payPeriod === emp.payPeriod;
              return (
                <div key={`${emp.employeeId}-${emp.payPeriod}`}
                  onClick={() => { setSelectedEmployee(emp); }}
                  className={`rounded-xl border cursor-pointer transition-all px-3 py-2.5 ${
                    isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-slate-700 truncate">{emp.employeeName}</span>
                      {emp.nickname && <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">{emp.nickname}</span>}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">{emp.employeeId}</span>
                  </div>
                  {emp.position && <div className="text-[10px] text-slate-400 mb-1.5 truncate">{emp.position}</div>}
                  <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100">
                    <div className="text-center">
                      <div className="text-[9px] text-emerald-600 font-semibold">รายได้</div>
                      <div className="text-[11px] font-bold text-emerald-600">{emp.totalIncome.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <div className="text-[9px] text-rose-500 font-semibold">หัก</div>
                      <div className="text-[11px] font-bold text-rose-500">{emp.totalDeduction.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-blue-600 font-semibold">สุทธิ</div>
                      <div className="text-[11px] font-bold text-blue-600">{emp.netSalary.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail */}
        <div className="flex flex-col overflow-hidden bg-slate-50">
          {!selectedEmployee ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-sm font-medium">เลือกพนักงานเพื่อดูสลิป</p>
            </div>
          ) : (
            <>
              {/* Header — same structure as receipt */}
              <div className="flex-none px-3 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">พนักงาน</p>
                    <p className="text-base font-bold text-slate-800 truncate">{selectedEmployee.employeeName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">เงินสุทธิ</p>
                    <p className="text-base font-bold text-blue-600">฿{selectedEmployee.netSalary.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-2.5">
                  <div><span className="text-slate-400">รหัส: </span>{selectedEmployee.employeeId}</div>
                  <div><span className="text-slate-400">งวด: </span><span className="font-semibold">{selectedEmployee.payPeriod}</span></div>
                  {selectedEmployee.position && <div className="col-span-2 truncate"><span className="text-slate-400">ตำแหน่ง: </span>{selectedEmployee.position}</div>}
                  {selectedEmployee.bankAccount && <div className="col-span-2 truncate"><span className="text-slate-400">บัญชี: </span>{selectedEmployee.bankAccount}</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPreview(true)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    พรีวิว
                  </button>
                  <button onClick={() => handleGeneratePDF(selectedEmployee)} disabled={generating}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {generating ? (
                      <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>กำลังสร้าง...</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>ดาวน์โหลด PDF</>
                    )}
                  </button>
                </div>
              </div>

              {/* Items — same structure as receipt */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {buildEarningsArray(selectedEmployee).map((item) => (
                  <div key={item.fieldName} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                    <div className="text-[10px] font-bold text-emerald-600 mb-1">รายได้</div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="font-semibold text-slate-700">{item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
                {buildDeductionsArray(selectedEmployee).map((item) => (
                  <div key={item.fieldName} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                    <div className="text-[10px] font-bold text-rose-500 mb-1">รายการหัก</div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="font-semibold text-slate-700">{item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="text-xl font-bold text-slate-800">{selectedEmployee.employeeName}</p>
                <p className="text-sm text-slate-400">{selectedEmployee.payPeriod}</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-6">
              <PayrollSlipPreview
                companyInfo={{
                  company_name:    companyInfo?.company_name,
                  company_name_en: companyInfo?.company_name_en,
                  address:         companyInfo?.address,
                  tel:             companyInfo?.phone || companyInfo?.tel,
                  tax_id:          companyInfo?.tax_id,
                  logo_url:        companyInfo?.logo_url,
                }}
                payPeriod={selectedEmployee.payPeriod}
                employeeId={selectedEmployee.employeeId}
                employeeName={selectedEmployee.employeeName}
                nickname={selectedEmployee.nickname}
                position={selectedEmployee.position}
                workingDays={selectedEmployee.workingDays}
                leaveDays={selectedEmployee.leaveDays}
                lateMinutes={selectedEmployee.lateMinutes}
                bankAccount={selectedEmployee.bankAccount}
                earnings={buildEarningsArray(selectedEmployee)}
                deductions={buildDeductionsArray(selectedEmployee)}
                totalIncome={selectedEmployee.totalIncome}
                totalDeduction={selectedEmployee.totalDeduction}
                netSalary={selectedEmployee.netSalary}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}