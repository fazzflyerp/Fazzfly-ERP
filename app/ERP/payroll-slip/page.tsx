/**
 * =============================================================================
 * FILE: app/ERP/payroll-slip/page.tsx
 * =============================================================================
 * Payroll Slip System - UI สวยเหมือน Sales + แสดงรายรับครบ
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
  earnedSalary: number;
  totalCommission: number;
  bonus: number;
  otBonus: number;
  totalIncome: number;
  leaveDeduction: number;
  lateDeduction: number;
  advanceDeduction: number;
  socialSecurity: number;
  taxWithholding: number;
  otherDeduction: number;
  totalDeduction: number;
  netSalary: number;
  rawData: any;
}

export default function PayrollSlipPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [moduleInfo, setModuleInfo] = useState<any>(null);
  const [config, setConfig] = useState<ConfigField[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      initializeData();
    }
  }, [status]);

  const initializeData = async () => {
    try {
      setLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const moduleIdFromURL = urlParams.get("moduleId");
      const spreadsheetIdFromURL = urlParams.get("spreadsheetId");

      if (!moduleIdFromURL || !spreadsheetIdFromURL) {
        throw new Error("Missing moduleId or spreadsheetId");
      }

      const accessToken = (session as any)?.accessToken;
      if (!accessToken) throw new Error("No access token");

      const userModulesRes = await fetch("/api/user/modules", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userModulesRes.ok) throw new Error("Failed to fetch user modules");

      const userData = await userModulesRes.json();
      const clientId = userData.clientId;

      const docsRes = await fetch(`/api/user/documents?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!docsRes.ok) throw new Error("Failed to fetch documents");

      const docsData = await docsRes.json();
      const document = docsData.documents.find((d: any) => d.moduleId === moduleIdFromURL);
      if (!document) throw new Error("Module not found");

      // ✅ เก็บ document ทั้งก้อน (เหมือนใบเสร็จ)
      setModuleInfo(document);
      console.log("✅ Module Info:", document);
      console.log("📁 Folder ID:", document.folderID);

      const [configRes, transRes, companyRes] = await Promise.all([
        fetch(`/api/payroll/config?spreadsheetId=${document.spreadsheetId}&configName=${document.configName}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/payroll/transactions?spreadsheetId=${document.spreadsheetId}&sheetName=${document.sheetName}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/payroll/company-info?spreadsheetId=${document.spreadsheetId}&sheetName=${document.companyName || "company_info"}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ]);

      if (!configRes.ok || !transRes.ok) throw new Error("Failed to fetch data");

      const configData = await configRes.json();
      const transData = await transRes.json();
      const companyData = companyRes.ok ? await companyRes.json() : null;

      console.log("✅ Config:", configData.fields.length, "fields");
      console.log("✅ Transactions:", transData.transactions.length, "rows");

      setConfig(configData.fields);
      setTransactions(transData.transactions);
      setCompanyInfo(companyData?.companyInfo);

      processPayrollData(configData.fields, transData.transactions);
      setLoading(false);
    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const processPayrollData = (configFields: ConfigField[], rawTransactions: any[]) => {
    console.log("🔄 Processing payroll data...");
    console.log("📋 Config fields:", configFields.length);
    console.log("📊 Raw transactions:", rawTransactions.length);

    const mapTransaction = (transaction: any): any => {
      const mapped: any = {};
      configFields.forEach((field) => {
        if (field.order !== null) {
          mapped[field.fieldName] = transaction.data[field.order - 1] || "";
        }
      });
      return mapped;
    };

    const parseNum = (val: any): number => {
      if (!val) return 0;
      const num = parseFloat(val.toString().replace(/,/g, ""));
      return isNaN(num) ? 0 : num;
    };

    const mappedData = rawTransactions.map(mapTransaction);

    // ✅ Debug: แสดงข้อมูล mapped ตัวแรก
    if (mappedData.length > 0) {
      console.log("🔍 Sample mapped data (first employee):");
      console.log("   Raw data:", mappedData[0]);
      console.log("   Field names:", Object.keys(mappedData[0]));
    }

    const employeeList: PayrollEmployee[] = mappedData.map((data: any) => {
      const earnedSalary = parseNum(data.earned_salary);
      const totalCommission = parseNum(data.total_commission);
      const bonus = parseNum(data.bonus);
      const otBonus = parseNum(data.ot_bonus);
      const totalIncome = parseNum(data.total_income);
      
      const leaveDeduction = parseNum(data.leave_deduction);
      const lateDeduction = parseNum(data.late_deduction);
      const advanceDeduction = parseNum(data.advance_deduction);
      const socialSecurity = parseNum(data.social_security);
      const taxWithholding = parseNum(data.tax_withholding);
      const otherDeduction = parseNum(data.other_deduction);
      const totalDeduction = parseNum(data.total_deduction);
      const netSalary = parseNum(data.net_salary);

      console.log(`📊 Employee: ${data.employee_name}`);
      console.log(`   🟢 Earnings Raw:`, {
        earned_salary: data.earned_salary,
        total_commission: data.total_commission,
        bonus: data.bonus,
        ot_bonus: data.ot_bonus,
        total_income: data.total_income
      });
      console.log(`   🟢 Earnings Parsed:`, {
        earnedSalary,
        totalCommission,
        bonus,
        otBonus,
        totalIncome
      });
      console.log(`   🔴 Deductions:`, { totalDeduction });
      console.log(`   💰 Net:`, netSalary);

      return {
        employeeId: data.employee_id || "N/A",
        employeeName: data.employee_name || "N/A",
        nickname: data.nickname,
        position: data.position,
        payPeriod: data.pay_period || "N/A",
        workingDays: parseNum(data.working_days),
        leaveDays: parseNum(data.leave_days),
        lateMinutes: parseNum(data.late_minutes),
        bankAccount: data.bank_account,
        earnedSalary,
        totalCommission,
        bonus,
        otBonus,
        totalIncome,
        leaveDeduction,
        lateDeduction,
        advanceDeduction,
        socialSecurity,
        taxWithholding,
        otherDeduction,
        totalDeduction,
        netSalary,
        rawData: data,
      };
    });

    console.log("✅ Processed", employeeList.length, "employees");

    const periods = Array.from(new Set(employeeList.map(e => e.payPeriod)))
      .filter(p => p !== "N/A")
      .sort((a, b) => b.localeCompare(a));

    setEmployees(employeeList);
    setAvailablePeriods(periods);
    if (periods.length > 0) setSelectedPeriod(periods[0]);
  };

  useEffect(() => {
    if (!selectedPeriod) {
      setFilteredEmployees([]);
      return;
    }

    let filtered = employees.filter(e => e.payPeriod === selectedPeriod);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.employeeName.toLowerCase().includes(term) ||
        e.employeeId.toLowerCase().includes(term) ||
        e.nickname?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      return sortOrder === 'newest' 
        ? b.employeeName.localeCompare(a.employeeName)
        : a.employeeName.localeCompare(b.employeeName);
    });

    setFilteredEmployees(filtered);
  }, [selectedPeriod, employees, searchTerm, sortOrder]);

  const handleGeneratePDF = async (employee: PayrollEmployee) => {
    if (!companyInfo) return;

    try {
      setGenerating(true);
      console.log("📄 Generating PDF for:", employee.employeeId);

      // ✅ Build earnings array
      const earnings: { label: string; amount: number }[] = [];
      
      if (employee.earnedSalary > 0) {
        const field = config.find(f => f.fieldName === "earned_salary");
        earnings.push({ 
          label: field?.label || "เงินเดือนที่ได้", 
          amount: employee.earnedSalary 
        });
      }
      
      if (employee.totalCommission > 0) {
        const field = config.find(f => f.fieldName === "total_commission");
        earnings.push({ 
          label: field?.label || "ค่าคอมรวม", 
          amount: employee.totalCommission 
        });
      }
      
      if (employee.bonus > 0) {
        const field = config.find(f => f.fieldName === "bonus");
        earnings.push({ 
          label: field?.label || "Bonus", 
          amount: employee.bonus 
        });
      }
      
      if (employee.otBonus > 0) {
        const field = config.find(f => f.fieldName === "ot_bonus");
        earnings.push({ 
          label: field?.label || "โบนัส OT", 
          amount: employee.otBonus 
        });
      }

      console.log("✅ Earnings array:", earnings);

      // ✅ Build deductions array
      const deductions: { label: string; amount: number }[] = [];
      
      if (employee.leaveDeduction > 0) {
        const field = config.find(f => f.fieldName === "leave_deduction");
        deductions.push({ 
          label: field?.label || "หักจากวันลา", 
          amount: employee.leaveDeduction 
        });
      }
      
      if (employee.lateDeduction > 0) {
        const field = config.find(f => f.fieldName === "late_deduction");
        deductions.push({ 
          label: field?.label || "หักมาสาย", 
          amount: employee.lateDeduction 
        });
      }
      
      if (employee.advanceDeduction > 0) {
        const field = config.find(f => f.fieldName === "advance_deduction");
        deductions.push({ 
          label: field?.label || "เบิกเงินล่วงหน้า", 
          amount: employee.advanceDeduction 
        });
      }
      
      if (employee.socialSecurity > 0) {
        const field = config.find(f => f.fieldName === "social_security");
        deductions.push({ 
          label: field?.label || "ประกันสังคม", 
          amount: employee.socialSecurity 
        });
      }
      
      if (employee.taxWithholding > 0) {
        const field = config.find(f => f.fieldName === "tax_withholding");
        deductions.push({ 
          label: field?.label || "หัก ณ ที่จ่าย", 
          amount: employee.taxWithholding 
        });
      }
      
      if (employee.otherDeduction > 0) {
        const field = config.find(f => f.fieldName === "other_deduction");
        deductions.push({ 
          label: field?.label || "อื่นๆ", 
          amount: employee.otherDeduction 
        });
      }

      console.log("✅ Deductions array:", deductions);

      const pdfData = {
        companyInfo: {
          company_name: companyInfo.company_name || "บริษัท ทดสอบ จำกัด",
          company_name_en: companyInfo.company_name_en,
          address: companyInfo.address || "123 ถนนทดสอบ",
          tel: companyInfo.phone || companyInfo.tel || "02-123-4567",
          tax_id: companyInfo.tax_id || "0-0000-00000-00-0",
          logo_url: companyInfo.logo_url,
        },
        payPeriod: employee.payPeriod,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        nickname: employee.nickname,
        position: employee.position,
        workingDays: employee.workingDays,
        leaveDays: employee.leaveDays,
        lateMinutes: employee.lateMinutes,
        bankAccount: employee.bankAccount,
        earnings,
        deductions,
        totalIncome: employee.totalIncome,
        totalDeduction: employee.totalDeduction,
        netSalary: employee.netSalary,
      };

      const response = await fetch("/api/payroll/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfData),
      });

      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      
      // ✅ 1. Parse YYYY-MM จาก payPeriod เพื่อให้ชื่อไฟล์เหมือนที่อัปโหลด Drive
      const periodParts = employee.payPeriod.trim().split(/\s+/);
      const year = periodParts[periodParts.length - 1];
      
      const thaiMonthsFull = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
      ];
      const thaiMonthsShort = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
      ];
      const engMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      let monthNum = "01";
      const monthName = periodParts[0];
      
      let thaiIndex = thaiMonthsFull.indexOf(monthName);
      if (thaiIndex !== -1) {
        monthNum = String(thaiIndex + 1).padStart(2, '0');
      } else {
        thaiIndex = thaiMonthsShort.indexOf(monthName);
        if (thaiIndex !== -1) {
          monthNum = String(thaiIndex + 1).padStart(2, '0');
        } else {
          const engIndex = engMonths.indexOf(monthName);
          if (engIndex !== -1) {
            monthNum = String(engIndex + 1).padStart(2, '0');
          }
        }
      }
      
      const yearMonth = `${year}-${monthNum}`;
      
      // ดาวน์โหลด PDF
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${employee.employeeName}_${yearMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log("✅ PDF downloaded!");

      // ✅ 2. Upload ไป Google Drive (เหมือนใบเสร็จ)
      console.log("🔍 Checking moduleInfo:", moduleInfo);
      const rootFolderId = moduleInfo.folderID;
      
      if (!rootFolderId) {
        console.error("❌ ไม่พบ Folder ID ใน moduleInfo");
        console.log("📋 moduleInfo:", JSON.stringify(moduleInfo, null, 2));
        alert("✅ ดาวน์โหลด PDF สำเร็จ! (ไม่พบ Folder ID สำหรับบันทึก)");
        return;
      }

      console.log("✅ Found Folder ID:", rootFolderId);
      console.log("📤 Uploading to Google Drive...");
      
      const accessToken = (session as any)?.accessToken;
      if (!accessToken) {
        console.error("❌ No access token for upload");
        alert("✅ ดาวน์โหลด PDF สำเร็จ! (ไม่มี access token)");
        return;
      }

      console.log("✅ Access token found");

      const uploadFormData = new FormData();
      uploadFormData.append("file", blob, `${employee.employeeName}.pdf`);
      uploadFormData.append("employeeId", employee.employeeId);
      uploadFormData.append("employeeName", employee.employeeName);
      uploadFormData.append("payPeriod", employee.payPeriod);
      uploadFormData.append("rootFolderId", rootFolderId);

      console.log("📦 FormData prepared:", {
        fileName: `${employee.employeeName}.pdf`,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        payPeriod: employee.payPeriod,
        rootFolderId: rootFolderId,
      });

      console.log("🚀 Calling upload API...");
      const uploadResponse = await fetch("/api/payroll/upload-pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadFormData,
      });

      console.log("📨 Upload response status:", uploadResponse.status);

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log("✅ Uploaded to Drive:", uploadData);
        alert(`✅ ดาวน์โหลดและบันทึกลง Google Drive สำเร็จ!\n📁 ${uploadData.folderPath}${uploadData.fileName}`);
      } else {
        const errorText = await uploadResponse.text();
        console.error("❌ Upload failed:", errorText);
        alert("✅ ดาวน์โหลด PDF สำเร็จ! (แต่บันทึกลง Drive ไม่สำเร็จ)");
      }
    } catch (err: any) {
      console.error("❌ PDF Error:", err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Helper function to build earnings/deductions for preview
  const buildEarningsArray = (emp: PayrollEmployee) => {
    const earnings: { fieldName: string; label: string; amount: number }[] = [];
    
    console.log("🔍 Building earnings for:", emp.employeeName);
    console.log("   earnedSalary:", emp.earnedSalary);
    console.log("   totalCommission:", emp.totalCommission);
    console.log("   bonus:", emp.bonus);
    console.log("   otBonus:", emp.otBonus);
    
    // ✅ แสดงทุกรายการ (รวม 0 ด้วย เพื่อ debug)
    const field1 = config.find(f => f.fieldName === "earned_salary");
    earnings.push({ 
      fieldName: "earned_salary",
      label: field1?.label || "เงินเดือนที่ได้", 
      amount: emp.earnedSalary 
    });
    
    const field2 = config.find(f => f.fieldName === "total_commission");
    earnings.push({ 
      fieldName: "total_commission",
      label: field2?.label || "ค่าคอมรวม", 
      amount: emp.totalCommission 
    });
    
    const field3 = config.find(f => f.fieldName === "bonus");
    earnings.push({ 
      fieldName: "bonus",
      label: field3?.label || "Bonus", 
      amount: emp.bonus 
    });
    
    const field4 = config.find(f => f.fieldName === "ot_bonus");
    earnings.push({ 
      fieldName: "ot_bonus",
      label: field4?.label || "โบนัส OT", 
      amount: emp.otBonus 
    });
    
    console.log("✅ Final earnings array:", earnings);
    
    return earnings;
  };

  const buildDeductionsArray = (emp: PayrollEmployee) => {
    const deductions: { fieldName: string; label: string; amount: number }[] = [];
    
    console.log("🔍 Building deductions for:", emp.employeeName);
    console.log("   leaveDeduction:", emp.leaveDeduction);
    console.log("   lateDeduction:", emp.lateDeduction);
    console.log("   advanceDeduction:", emp.advanceDeduction);
    console.log("   socialSecurity:", emp.socialSecurity);
    console.log("   taxWithholding:", emp.taxWithholding);
    console.log("   otherDeduction:", emp.otherDeduction);
    
    // ✅ แสดงทุกรายการ (รวม 0 ด้วย เพื่อ debug)
    const field1 = config.find(f => f.fieldName === "leave_deduction");
    deductions.push({ 
      fieldName: "leave_deduction",
      label: field1?.label || "หักจากวันลา", 
      amount: emp.leaveDeduction 
    });
    
    const field2 = config.find(f => f.fieldName === "late_deduction");
    deductions.push({ 
      fieldName: "late_deduction",
      label: field2?.label || "หักมาสาย", 
      amount: emp.lateDeduction 
    });
    
    const field3 = config.find(f => f.fieldName === "advance_deduction");
    deductions.push({ 
      fieldName: "advance_deduction",
      label: field3?.label || "เบิกเงินล่วงหน้า", 
      amount: emp.advanceDeduction 
    });
    
    const field4 = config.find(f => f.fieldName === "social_security");
    deductions.push({ 
      fieldName: "social_security",
      label: field4?.label || "ประกันสังคม", 
      amount: emp.socialSecurity 
    });
    
    const field5 = config.find(f => f.fieldName === "tax_withholding");
    deductions.push({ 
      fieldName: "tax_withholding",
      label: field5?.label || "หัก ณ ที่จ่าย", 
      amount: emp.taxWithholding 
    });
    
    const field6 = config.find(f => f.fieldName === "other_deduction");
    deductions.push({ 
      fieldName: "other_deduction",
      label: field6?.label || "อื่นๆ", 
      amount: emp.otherDeduction 
    });
    
    console.log("✅ Final deductions array:", deductions);
    
    return deductions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium text-lg">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/ERP/home" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - Blue Theme เหมือน Sales แต่สีน้ำเงิน */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-blue-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/ERP/home" className="group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all duration-300 border border-gray-200 shadow-sm">
                <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">กลับ</span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">ออกสลิปเงินเดือน</h1>
                  {moduleInfo && <p className="text-sm text-gray-600 mt-0.5">{moduleInfo.module_name}</p>}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="text-xs text-blue-600 font-medium mb-0.5">พนักงานทั้งหมด</div>
                <div className="text-xl font-bold text-blue-700">{employees.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Layout แก้เป็น 2:3 (Preview กว้างกว่า) */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          
          {/* Left: Employee List - 2 columns (แคบลง) */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              {/* List Header */}
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

                {/* Sort & Filter Controls */}
                <div className="flex flex-wrap gap-2">
                  {/* Period Selector */}
                  <select
                    value={selectedPeriod}
                    onChange={(e) => {
                      setSelectedPeriod(e.target.value);
                      setShowPreview(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกงวด --</option>
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>

                  {/* Sort Buttons */}
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                    <button
                      onClick={() => setSortOrder('newest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        sortOrder === 'newest'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        A → Z
                      </span>
                    </button>
                    <button
                      onClick={() => setSortOrder('oldest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        sortOrder === 'oldest'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Z → A
                      </span>
                    </button>
                  </div>

                  {/* Search */}
                  <input
                    type="text"
                    placeholder="🔍 ค้นหา..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 min-w-[150px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!selectedPeriod}
                  />
                </div>
              </div>

              {/* List Content */}
              <div className="p-4">
                {!selectedPeriod ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">เลือกงวดเงินเดือน</p>
                    <p className="text-gray-500 text-sm mt-1">กรุณาเลือกงวดจากด้านบน</p>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">ไม่พบพนักงาน</p>
                    <p className="text-gray-500 text-sm mt-1">ลองเปลี่ยนคำค้นหา</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.employeeId}
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setShowPreview(true);
                        }}
                        className={`group relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                          selectedEmployee?.employeeId === emp.employeeId
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.01] bg-white'
                        }`}
                      >
                        {/* Header Section */}
                        <div className="relative flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-800 text-lg truncate">
                                {emp.employeeName}
                              </h3>
                              {emp.nickname && (
                                <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full whitespace-nowrap">
                                  {emp.nickname}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">
                                {emp.employeeId}
                              </span>
                              {emp.position && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="truncate">{emp.position}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Selected Indicator - ลบออกแล้ว */}
                        </div>

                        {/* Financial Summary */}
                        <div className="relative grid grid-cols-3 gap-3 pt-4 border-t-2 border-gray-200">
                          {/* รายได้ */}
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                              <span className="text-xs text-gray-500 font-medium">รายได้</span>
                            </div>
                            <div className="font-bold text-emerald-600 text-base">
                              {emp.totalIncome.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-gray-400">บาท</div>
                          </div>

                          {/* รายการหัก */}
                          <div className="text-center border-x border-gray-200">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                              <span className="text-xs text-gray-500 font-medium">หัก</span>
                            </div>
                            <div className="font-bold text-rose-600 text-base">
                              {emp.totalDeduction.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-gray-400">บาท</div>
                          </div>

                          {/* สุทธิ */}
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs text-gray-500 font-medium">สุทธิ</span>
                            </div>
                            <div className="font-bold text-blue-600 text-lg">
                              {emp.netSalary.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-gray-400">บาท</div>
                          </div>
                        </div>

                        {/* Hover Arrow Indicator */}
                        <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${
                          selectedEmployee?.employeeId === emp.employeeId 
                            ? 'opacity-0' 
                            : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                        }`}>
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview - 3 columns (กว้างขึ้น) */}
          <div className="xl:col-span-3">
            {showPreview && selectedEmployee ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden sticky top-24">
                {/* Preview Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 mb-1">พรีวิวสลิป</h3>
                      <p className="text-sm text-gray-600 truncate">
                        {selectedEmployee.employeeName} • {selectedEmployee.payPeriod}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {/* Download Button */}
                      <button
                        onClick={() => handleGeneratePDF(selectedEmployee)}
                        disabled={generating}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {generating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span className="text-sm">กำลังสร้าง...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm">ดาวน์โหลด PDF</span>
                          </>
                        )}
                      </button>

                      {/* Close Button */}
                      <button
                        onClick={() => setShowPreview(false)}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview Content - ใช้ scale และ center สำหรับหน้าจอใหญ่ */}
                <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar bg-gray-50">
                  {/* Container สำหรับ scale */}
                  <div className="flex items-start justify-center">
                    {/* Wrapper สำหรับ A4 slip - scale down บนหน้าจอใหญ่ */}
                    <div 
                      className="origin-top"
                      style={{
                        transform: 'scale(0.85)',
                        transformOrigin: 'top center',
                      }}
                    >
                      <PayrollSlipPreview
                        companyInfo={{
                          company_name: companyInfo?.company_name,
                          company_name_en: companyInfo?.company_name_en,
                          address: companyInfo?.address,
                          tel: companyInfo?.phone || companyInfo?.tel,
                          tax_id: companyInfo?.tax_id,
                          logo_url: companyInfo?.logo_url,
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">เลือกพนักงาน</p>
                <p className="text-gray-500 text-sm mt-1">คลิกที่รายชื่อเพื่อดูสลิป</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}