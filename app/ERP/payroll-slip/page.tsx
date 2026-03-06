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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-white/90 backdrop-blur-lg border-b border-blue-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/ERP/home" className="group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all duration-300 border border-gray-200 shadow-sm">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                <span className="text-sm font-semibold text-gray-700">กลับ</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">ออกสลิปเงินเดือน</h1>
                  {moduleInfo && <p className="text-sm text-gray-600 mt-0.5">{moduleInfo.module_name}</p>}
                </div>
              </div>
            </div>

            {/* Right: Stats + Refresh */}
            <div className="hidden md:flex items-center gap-3">
              {/* ✅ NEW: Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-all shadow-sm disabled:opacity-50"
              >
                <svg
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? "กำลังโหลด..." : "Refresh"}
              </button>

              <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="text-xs text-blue-600 font-medium mb-0.5">พนักงานทั้งหมด</div>
                <div className="text-xl font-bold text-blue-700">{employees.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Left: Employee List */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    รายชื่อพนักงาน
                  </h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold border border-blue-200">
                    {filteredEmployees.length} คน
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={selectedPeriod} onChange={(e) => { setSelectedPeriod(e.target.value); setShowPreview(false); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- เลือกงวด --</option>
                    {availablePeriods.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                    {(['newest','oldest'] as const).map(order => (
                      <button key={order} onClick={() => setSortOrder(order)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${sortOrder === order ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
                        {order === 'newest' ? 'A → Z' : 'Z → A'}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="🔍 ค้นหา..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} disabled={!selectedPeriod}
                    className="flex-1 min-w-[150px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"/>

                  {/* ✅ Mobile Refresh Button */}
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-all disabled:opacity-50"
                  >
                    <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {refreshing ? "โหลด..." : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="p-4">
                {!selectedPeriod ? (
                  <div className="text-center py-16 text-gray-500">เลือกงวดเงินเดือน</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">ไม่พบพนักงาน</div>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredEmployees.map(emp => (
                      <div key={`${emp.employeeId}-${emp.payPeriod}`}
                        onClick={() => { setSelectedEmployee(emp); setShowPreview(true); }}
                        className={`group p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                          selectedEmployee?.employeeId === emp.employeeId && selectedEmployee?.payPeriod === emp.payPeriod
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.01] bg-white'}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-800 text-lg truncate">{emp.employeeName}</h3>
                              {emp.nickname && <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">{emp.nickname}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">{emp.employeeId}</span>
                              {emp.position && <><span className="text-gray-400">•</span><span className="truncate">{emp.position}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t-2 border-gray-200">
                          {[
                            { label: 'รายได้', val: emp.totalIncome,    color: 'emerald' },
                            { label: 'หัก',    val: emp.totalDeduction, color: 'rose'    },
                            { label: 'สุทธิ',  val: emp.netSalary,      color: 'blue'    },
                          ].map((item, i) => (
                            <div key={i} className={`text-center ${i === 1 ? 'border-x border-gray-200' : ''}`}>
                              <div className="flex items-center justify-center gap-1 mb-1">
                                <div className={`w-2 h-2 bg-${item.color}-500 rounded-full`}></div>
                                <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                              </div>
                              <div className={`font-bold text-${item.color}-600 ${i === 2 ? 'text-lg' : 'text-base'}`}>
                                {item.val.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-xs text-gray-400">บาท</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="xl:col-span-3">
            {showPreview && selectedEmployee ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden sticky top-24">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 mb-1">พรีวิวสลิป</h3>
                      <p className="text-sm text-gray-600 truncate">{selectedEmployee.employeeName} • {selectedEmployee.payPeriod}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleGeneratePDF(selectedEmployee)} disabled={generating}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                        {generating ? (
                          <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span className="text-sm">กำลังสร้าง...</span></>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span className="text-sm">ดาวน์โหลด PDF</span></>
                        )}
                      </button>
                      <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white rounded-lg transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar bg-gray-50">
                  <div className="flex items-start justify-center">
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
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
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">เลือกพนักงาน</p>
                <p className="text-gray-500 text-sm mt-1">คลิกที่รายชื่อเพื่อดูสลิป</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}