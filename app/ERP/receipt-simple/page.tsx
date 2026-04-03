/**
 * =============================================================================
 * FILE PATH: app/ERP/receipt-simple/page.tsx
 * =============================================================================
 * 
 * Receipt Generation Page
 * หน้าออกใบเสร็จ - เลือก transaction, พรีวิว, ดาวน์โหลด PDF
 */

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";
import ReceiptPreview from "@/app/components/ReceiptPreview";

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number | null;
}

interface Transaction {
  rowIndex: number;
  data: any[];
}

interface MappedTransaction {
  [key: string]: any;
  _rowIndex: number;
}

interface GroupedReceipt {
  receiptNo: string;
  date: string;
  customerName: string;
  programs: string;
  items: MappedTransaction[];
  totalAmount: number;
}

export default function ReceiptSimplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL Parameters
  const moduleId = searchParams.get("moduleId");
  const spreadsheetId = searchParams.get("spreadsheetId");

  // ✅ Detect if VAT is used
  const [hasVAT, setHasVAT] = useState(false);

  // States
  const [config, setConfig] = useState<ConfigField[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mappedTransactions, setMappedTransactions] = useState<MappedTransaction[]>([]);
  const [groupedReceipts, setGroupedReceipts] = useState<GroupedReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<GroupedReceipt | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Module info (from documents API)
  const [moduleInfo, setModuleInfo] = useState<any>(null);
  const [navOpen, setNavOpen] = useState(false);

  // ✅ Company info & Preview modal
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ✅ Sort & Filter states
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // ✅ NEW: Refresh state
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      if (!moduleId || !spreadsheetId) {
        setError("Missing required parameters");
        setLoading(false);
        return;
      }
      fetchModuleInfo();
    }
  }, [status, moduleId, spreadsheetId]);

  // ✅ 1. Fetch Module Info
  const fetchModuleInfo = async () => {
    try {
      setLoading(true);
      const accessToken = (session as any)?.accessToken;

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
      const module = docsData.documents.find((d: any) => d.moduleId === moduleId);
      if (!module) throw new Error("Module not found");

      setModuleInfo(module);

      await Promise.all([
        fetchConfig(module.configName),
        fetchTransactions(module.sheetName),
        fetchCompanyInfo("company_info"),
      ]);

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Refresh handler — re-fetch transactions only
  const handleRefresh = async () => {
    if (!moduleInfo || refreshing) return;
    setRefreshing(true);
    try {
      await fetchTransactions(moduleInfo.sheetName);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ Fetch Company Info
  const fetchCompanyInfo = async (sheetName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/company-info?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setCompanyInfo(data.companyInfo);
    } catch (err: any) {
      console.warn("⚠️ Company info error:", err);
    }
  };

  // ✅ 2. Fetch Config
  const fetchConfig = async (configName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/config?spreadsheetId=${spreadsheetId}&configName=${configName}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setConfig(data.fields);

      const vatField = data.fields.find((f: ConfigField) => {
        const fieldNameLower = (f.fieldName || '').toLowerCase().trim();
        return fieldNameLower === 'vat';
      });
      const hasVATEnabled = !!(vatField && vatField.order !== null && vatField.order !== undefined);
      setHasVAT(hasVATEnabled);
    } catch (err: any) {
      throw err;
    }
  };

  // ✅ 3. Fetch Transactions
  const fetchTransactions = async (sheetName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/transactions?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store", // ✅ ไม่ cache — ได้ข้อมูลล่าสุดเสมอ
      });
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const data = await response.json();
      setTransactions(data.transactions);
    } catch (err: any) {
      throw err;
    }
  };

  // ✅ 4. Map Transactions with Config และ Group by Receipt No
  useEffect(() => {
    if (config.length > 0 && transactions.length > 0) {
      const receiptNoField = config.find(
        (f) => {
          const fieldName = f.fieldName.toLowerCase();
          const label = f.label.toLowerCase();
          return (
            fieldName.includes("receipt") ||
            fieldName.includes("เลขที่") ||
            fieldName.includes("เลขใบเสร็จ") ||
            label.includes("receipt") ||
            label.includes("เลขที่") ||
            label.includes("ใบเสร็จ")
          );
        }
      );

      if (!receiptNoField || receiptNoField.order === null) {
        setGroupedReceipts([]);
        return;
      }

      const mapped = transactions
        .map((transaction) => {
          const mappedData: MappedTransaction = { _rowIndex: transaction.rowIndex };
          config.forEach((field) => {
            if (field.order !== null) {
              const columnIndex = field.order - 1;
              mappedData[field.fieldName] = transaction.data[columnIndex] || "";
            } else {
              mappedData[field.fieldName] = "";
            }
          });
          return mappedData;
        })
        .filter((t) => {
          const receiptNo = t[receiptNoField.fieldName]?.toString().trim();
          return receiptNo && receiptNo !== "";
        });

      if (mapped.length === 0) {
        setGroupedReceipts([]);
        setMappedTransactions([]);
        return;
      }

      const grouped = new Map<string, MappedTransaction[]>();
      mapped.forEach((transaction) => {
        const receiptNo = transaction[receiptNoField.fieldName]?.toString().trim();
        if (!grouped.has(receiptNo)) grouped.set(receiptNo, []);
        grouped.get(receiptNo)!.push(transaction);
      });

      const groupedArray: GroupedReceipt[] = Array.from(grouped.entries()).map(
        ([receiptNo, items]) => {
          const firstItem = items[0];

          const dateField = config.find((f) =>
            f.fieldName.toLowerCase().includes("date") ||
            f.fieldName.toLowerCase().includes("วันที่") ||
            f.label.toLowerCase().includes("date") ||
            f.label.toLowerCase().includes("วันที่")
          );
          const customerField = config.find((f) =>
            f.fieldName.toLowerCase().includes("cust") ||
            f.fieldName.toLowerCase().includes("ชื่อ") ||
            f.fieldName.toLowerCase().includes("name") ||
            f.label.toLowerCase().includes("customer") ||
            f.label.toLowerCase().includes("ลูกค้า") ||
            f.label.toLowerCase().includes("ชื่อ")
          );
          const amountField = config.find((f) => f.fieldName === "total_sales");
          const programField = config.find((f) =>
            f.fieldName.toLowerCase().includes("program") ||
            f.fieldName.toLowerCase().includes("โปรแกรม") ||
            f.fieldName.toLowerCase().includes("service") ||
            f.fieldName.toLowerCase().includes("บริการ") ||
            f.label.toLowerCase().includes("program") ||
            f.label.toLowerCase().includes("โปรแกรม") ||
            f.label.toLowerCase().includes("service") ||
            f.label.toLowerCase().includes("บริการ")
          );

          const totalAmount = items.reduce((sum, item) => {
            if (amountField) {
              const rawValue = item[amountField.fieldName];
              let cleanValue = rawValue;
              if (typeof rawValue === 'string') cleanValue = rawValue.replace(/,/g, '').trim();
              const amount = parseFloat(cleanValue || "0");
              return sum + (isNaN(amount) ? 0 : amount);
            }
            return sum;
          }, 0);

          const programs = items
            .map(item => programField ? item[programField.fieldName] : "")
            .filter(p => p && p.toString().trim() !== "")
            .filter((p, index, self) => self.indexOf(p) === index);

          return {
            receiptNo,
            date: dateField ? firstItem[dateField.fieldName] || "" : "",
            customerName: customerField ? firstItem[customerField.fieldName] || "" : "",
            programs: programs.length > 0 ? programs.join(", ") : "ไม่ระบุ",
            items,
            totalAmount,
          };
        }
      );

      groupedArray.sort((a, b) => b.receiptNo.localeCompare(a.receiptNo));
      setMappedTransactions(mapped);
      setGroupedReceipts(groupedArray);
    }
  }, [config, transactions]);

  // ✅ 5. Generate PDF and Upload to Google Drive
  const handleGeneratePDF = async () => {
    if (!selectedReceipt || !moduleInfo) return;
    try {
      setLoadingPDF(true);
      const rootFolderId = moduleInfo.folderID || "1tmYuBv_65_4i9TER1O1VHCHyF89FLL3ZmMc6pTVZn8";
      if (!rootFolderId) throw new Error("ไม่พบ Folder ID");

      const parseNumber = (val: any) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/,/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      const pdfData = {
        hasVAT,
        companyInfo: {
          company_name: companyInfo?.company_name || "บริษัท ทดสอบ จำกัด",
          company_name_en: companyInfo?.company_name_en,
          address: companyInfo?.address || "123 ถนนทดสอบ กรุงเทพฯ 10100",
          tel: companyInfo?.phone || companyInfo?.tel || "02-123-4567",
          phone: companyInfo?.phone || companyInfo?.tel || "02-123-4567",
          tax_id: companyInfo?.tax_id || "0-0000-00000-00-0",
          logo_url: companyInfo?.logo_url,
        },
        receiptNo: selectedReceipt.receiptNo,
        date: selectedReceipt.date,
        customerId: selectedReceipt.items[0]?.cust_id || "N/A",
        customerName: selectedReceipt.items[0]?.cust_name || "N/A",
        customerTel: selectedReceipt.items[0]?.cust_tel,
        customerAddress: selectedReceipt.items[0]?.cust_address,
        items: selectedReceipt.items.map((item) => {
          const afterVat = parseNumber(item.total_sales);
          const beforeVat = parseNumber(item.total_sales_beforevat);
          const vatPercentage = parseNumber(item.vat);
          const quantity = parseNumber(item.quantity);
          const vatAmount = beforeVat * (vatPercentage / 100);
          return {
            description: item.program || "สินค้า/บริการ",
            quantity: quantity || 1,
            amount_before_vat: beforeVat,
            vat_amount: vatAmount,
            amount_after_vat: afterVat,
          };
        }),
        subtotal_before_vat: selectedReceipt.items.reduce((sum, item) => {
          const val = item.total_sales_beforevat?.toString().replace(/,/g, '') || '0';
          return sum + parseFloat(val);
        }, 0),
        total_vat: selectedReceipt.items.reduce((sum, item) => {
          const beforeVat = parseFloat((item.total_sales_beforevat?.toString().replace(/,/g, '') || '0'));
          const vatPercentage = parseFloat((item.vat?.toString().replace(/,/g, '') || '0'));
          return sum + beforeVat * (vatPercentage / 100);
        }, 0),
        total_after_vat: selectedReceipt.items.reduce((sum, item) => {
          const val = item.total_sales?.toString().replace(/,/g, '') || '0';
          return sum + parseFloat(val);
        }, 0),
        paymentMethods: (() => {
          const payments: Array<{method: string, amount: number}> = [];
          const paymentTotals: Record<string, number> = {
            payment_1: 0, payment_2: 0, payment_3: 0, payment_4: 0, payment_5: 0,
          };
          selectedReceipt.items.forEach(item => {
            Object.keys(paymentTotals).forEach(key => {
              const val = item[key]?.toString().replace(/,/g, '') || '0';
              const amount = parseFloat(val);
              if (!isNaN(amount)) paymentTotals[key] += amount;
            });
          });
          const paymentLabels: Record<string, string> = {};
          config.forEach((field) => {
            if (field.fieldName.startsWith('payment_')) {
              paymentLabels[field.fieldName] = field.label || field.fieldName;
            }
          });
          if (Object.keys(paymentLabels).length === 0) {
            ['payment_1','payment_2','payment_3','payment_4','payment_5'].forEach(k => { paymentLabels[k] = k; });
          }
          Object.entries(paymentTotals).forEach(([key, amount]) => {
            if (amount > 0) payments.push({ method: paymentLabels[key], amount });
          });
          return payments;
        })(),
      };

      const accessToken = (session as any)?.accessToken;
      const pdfResponse = await fetch('/api/receipt/generate-pdf-html', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfData),
      });
      if (!pdfResponse.ok) throw new Error(`PDF generation failed: ${await pdfResponse.text()}`);

      const blob = await pdfResponse.blob();

      const formData = new FormData();
      formData.append('file', blob, `${pdfData.receiptNo}_${pdfData.customerId}.pdf`);
      formData.append('receiptNo', pdfData.receiptNo);
      formData.append('customerId', pdfData.customerId);
      formData.append('date', pdfData.date);
      formData.append('rootFolderId', rootFolderId);

      const uploadResponse = await fetch('/api/receipt/upload-pdf', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.details || 'Upload failed');
      }
      const uploadResult = await uploadResponse.json();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pdfData.receiptNo}_${pdfData.customerId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      alert(`✅ สร้างและบันทึก PDF สำเร็จ!\n\n📁 Folder: ${uploadResult.folderPath}\n📄 ไฟล์: ${uploadResult.fileName}\n\n🔗 ดูไฟล์: ${uploadResult.webViewLink}`);
    } catch (error: any) {
      alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setLoadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link href="/ERP/home" className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <QuickNavTrigger onClick={() => setNavOpen(true)} />
              <Link href="/ERP/home" className="group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all duration-300 border border-gray-200 shadow-sm">
                <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">กลับ</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">ออกใบเสร็จรับเงิน</h1>
                  {moduleInfo && <p className="text-sm text-gray-600 mt-0.5">{moduleInfo.moduleName}</p>}
                </div>
              </div>
            </div>

            {/* Right: Stats + Refresh */}
            <div className="hidden md:flex items-center gap-3">
              {/* ✅ NEW: Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-all shadow-sm disabled:opacity-50"
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

              <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-600 font-medium mb-0.5">ใบเสร็จทั้งหมด</div>
                <div className="text-xl font-bold text-emerald-700">{groupedReceipts.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Receipt List */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    รายการใบเสร็จ
                  </h2>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold border border-emerald-200">
                    {groupedReceipts.filter(r => {
                      if (selectedMonth === 'all') return true;
                      const date = new Date(r.date.split('/').reverse().join('-'));
                      const month = date.getMonth() + 1;
                      const year = date.getFullYear();
                      return `${year}-${month.toString().padStart(2, '0')}` === selectedMonth;
                    }).length} รายการ
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                    <button onClick={() => setSortOrder('newest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${sortOrder === 'newest' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        ใหม่ → เก่า
                      </span>
                    </button>
                    <button onClick={() => setSortOrder('oldest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${sortOrder === 'oldest' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        เก่า → ใหม่
                      </span>
                    </button>
                  </div>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="all">ทุกเดือน</option>
                    {(() => {
                      const months = new Set<string>();
                      groupedReceipts.forEach(r => {
                        try {
                          const date = new Date(r.date.split('/').reverse().join('-'));
                          const month = date.getMonth() + 1;
                          const year = date.getFullYear();
                          months.add(`${year}-${month.toString().padStart(2, '0')}`);
                        } catch (e) {}
                      });
                      return Array.from(months).sort().reverse().map(m => {
                        const [year, month] = m.split('-');
                        const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
                        return <option key={m} value={m}>{monthNames[parseInt(month)-1]} {parseInt(year)+543}</option>;
                      });
                    })()}
                  </select>

                  {/* ✅ Mobile Refresh Button */}
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-all disabled:opacity-50"
                  >
                    <svg className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {refreshing ? "โหลด..." : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="p-4">
                {groupedReceipts.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">ไม่มีรายการใบเสร็จ</p>
                    <p className="text-gray-500 text-sm mt-1">กรุณาตรวจสอบข้อมูลในระบบ</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-2 custom-scrollbar">
                    {groupedReceipts
                      .filter(receipt => {
                        if (selectedMonth === 'all') return true;
                        try {
                          const date = new Date(receipt.date.split('/').reverse().join('-'));
                          const month = date.getMonth() + 1;
                          const year = date.getFullYear();
                          return `${year}-${month.toString().padStart(2, '0')}` === selectedMonth;
                        } catch (e) { return false; }
                      })
                      .sort((a, b) => {
                        try {
                          const dateA = new Date(a.date.split('/').reverse().join('-'));
                          const dateB = new Date(b.date.split('/').reverse().join('-'));
                          return sortOrder === 'newest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
                        } catch (e) { return 0; }
                      })
                      .map((receipt, index) => (
                        <div key={index} onClick={() => setSelectedReceipt(receipt)}
                          className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            selectedReceipt?.receiptNo === receipt.receiptNo
                              ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50"
                              : "border-gray-200 bg-white hover:border-emerald-300"
                          }`}>
                          {selectedReceipt?.receiptNo === receipt.receiptNo && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-teal-600"></div>
                          )}
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">เลขที่</span>
                                  {selectedReceipt?.receiptNo === receipt.receiptNo && (
                                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">เลือกแล้ว</span>
                                  )}
                                </div>
                                <div className="text-xl font-bold text-gray-800 mb-1">{receipt.receiptNo}</div>
                              </div>
                              {selectedReceipt?.receiptNo === receipt.receiptNo ? (
                                <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="flex-shrink-0 w-8 h-8 border-2 border-gray-300 rounded-full group-hover:border-emerald-400 transition-colors"></div>
                              )}
                            </div>
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-gray-600">{receipt.date || "-"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-gray-700 font-medium">{receipt.customerName || "ไม่ระบุชื่อ"}</span>
                              </div>
                              <div className="flex items-start gap-2 text-sm">
                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="text-gray-700 line-clamp-2">{receipt.programs}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">{receipt.items.length} รายการ</span>
                              <div className="text-right">
                                <div className="text-xs text-gray-500 mb-0.5">ยอดรวม</div>
                                <div className={`text-lg font-bold ${receipt.totalAmount > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                                  {receipt.totalAmount > 0 ? `฿${receipt.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : "ไม่มียอด"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview & Generate */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden sticky top-24">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  รายละเอียดใบเสร็จ
                </h2>
              </div>

              <div className="p-6">
                {!selectedReceipt ? (
                  <div className="text-center py-20">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-3xl flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium text-lg mb-2">ยังไม่ได้เลือกใบเสร็จ</p>
                    <p className="text-gray-500 text-sm">กรุณาเลือกรายการด้านซ้ายเพื่อดูรายละเอียด</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-xs text-emerald-600 uppercase tracking-wide mb-1 font-medium">เลขที่ใบเสร็จ</div>
                          <div className="text-2xl font-bold text-gray-800">{selectedReceipt.receiptNo}</div>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-200 rounded-lg">
                          <div className="text-xs text-emerald-700 font-semibold">{selectedReceipt.items.length} รายการ</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">วันที่</div>
                            <div className="text-sm text-gray-800 font-medium flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {selectedReceipt.date || "-"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 mb-1">ลูกค้า</div>
                            <div className="text-sm text-gray-800 font-medium flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {selectedReceipt.customerName || "ไม่ระบุ"}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1.5">โปรแกรม/บริการ</div>
                          <div className="text-sm text-gray-800 font-medium bg-white rounded-lg p-3 border border-emerald-100">
                            <div className="flex items-start gap-2">
                              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span className="text-emerald-700">{selectedReceipt.programs}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">รายการสินค้า/บริการ</h3>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {selectedReceipt.items.map((item, index) => {
                          const displayFields = config.filter(f => f.order !== null).slice(0, 4);
                          return (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-xs font-semibold text-emerald-600">#{index + 1}</div>
                                <div className="text-xs text-gray-500">Row {item._rowIndex}</div>
                              </div>
                              <div className="space-y-1.5">
                                {displayFields.map((field) => (
                                  <div key={field.fieldName} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">{field.label}:</span>
                                    <span className="font-semibold text-gray-800">{item[field.fieldName] || "-"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-100 uppercase tracking-wide mb-1 font-medium">ยอดรวมทั้งหมด</div>
                          <div className="text-3xl font-bold text-white">
                            ฿{selectedReceipt.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button onClick={() => setShowPreview(true)}
                        className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-98">
                        <span className="flex items-center justify-center gap-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          พรีวิวใบเสร็จ
                        </span>
                      </button>
                      <button onClick={handleGeneratePDF} disabled={loadingPDF}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${loadingPDF ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl active:scale-98"}`}>
                        {loadingPDF ? (
                          <span className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            กำลังสร้าง PDF...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            ดาวน์โหลด PDF
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-blue-700 font-semibold mb-1">💡 คำแนะนำ</p>
                          <p className="text-sm text-blue-600">ระบบจะรวมทุกรายการที่มีเลขที่ใบเสร็จเดียวกันไว้ใน PDF เดียว</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(71,85,105,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.5); }
      `}</style>

      {/* Preview Modal */}
      {showPreview && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">ตัวอย่างใบเสร็จ</h3>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ReceiptPreview
                hasVAT={hasVAT}
                companyInfo={{
                  company_name: companyInfo?.company_name || "บริษัท ทดสอบ จำกัด",
                  company_name_en: companyInfo?.company_name_en,
                  address: companyInfo?.address || "123 ถนนทดสอบ กรุงเทพฯ 10100",
                  tel: companyInfo?.phone || companyInfo?.tel || "02-123-4567",
                  tax_id: companyInfo?.tax_id || "0-0000-00000-00-0",
                  logo_url: companyInfo?.logo_url,
                }}
                receiptNo={selectedReceipt.receiptNo}
                date={selectedReceipt.date}
                customerId={selectedReceipt.items[0]?.cust_id || "N/A"}
                customerName={selectedReceipt.items[0]?.cust_name || "N/A"}
                customerTel={selectedReceipt.items[0]?.cust_tel}
                customerAddress={selectedReceipt.items[0]?.cust_address}
                items={selectedReceipt.items.map((item) => {
                  const parseNumber = (val: any) => {
                    if (!val) return 0;
                    const cleaned = val.toString().replace(/,/g, '');
                    const num = parseFloat(cleaned);
                    return isNaN(num) ? 0 : num;
                  };
                  const afterVat = parseNumber(item.total_sales);
                  const beforeVat = parseNumber(item.total_sales_beforevat);
                  const vatPercentage = parseNumber(item.vat);
                  const quantity = parseNumber(item.quantity);
                  const vatAmount = beforeVat * (vatPercentage / 100);
                  return {
                    description: item.program || "สินค้า/บริการ",
                    quantity: quantity || 1,
                    amount_before_vat: beforeVat,
                    vat_amount: vatAmount,
                    amount_after_vat: afterVat,
                  };
                })}
                subtotal_before_vat={selectedReceipt.items.reduce((sum, item) => {
                  const val = item.total_sales_beforevat?.toString().replace(/,/g, '') || '0';
                  return sum + parseFloat(val);
                }, 0)}
                total_vat={selectedReceipt.items.reduce((sum, item) => {
                  const beforeVat = parseFloat((item.total_sales_beforevat?.toString().replace(/,/g, '') || '0'));
                  const vatPercentage = parseFloat((item.vat?.toString().replace(/,/g, '') || '0'));
                  return sum + beforeVat * (vatPercentage / 100);
                }, 0)}
                total_after_vat={selectedReceipt.items.reduce((sum, item) => {
                  const val = item.total_sales?.toString().replace(/,/g, '') || '0';
                  return sum + parseFloat(val);
                }, 0)}
                paymentMethods={(() => {
                  const payments: Array<{method: string, amount: number}> = [];
                  const paymentTotals: Record<string, number> = {
                    payment_1: 0, payment_2: 0, payment_3: 0, payment_4: 0, payment_5: 0,
                  };
                  selectedReceipt.items.forEach(item => {
                    Object.keys(paymentTotals).forEach(key => {
                      const val = item[key]?.toString().replace(/,/g, '') || '0';
                      const amount = parseFloat(val);
                      if (!isNaN(amount)) paymentTotals[key] += amount;
                    });
                  });
                  const paymentLabels: Record<string, string> = {};
                  config.forEach((field) => {
                    if (field.fieldName.startsWith('payment_')) {
                      paymentLabels[field.fieldName] = field.label || field.fieldName;
                    }
                  });
                  if (Object.keys(paymentLabels).length === 0) {
                    ['payment_1','payment_2','payment_3','payment_4','payment_5'].forEach(k => { paymentLabels[k] = k; });
                  }
                  Object.entries(paymentTotals).forEach(([key, amount]) => {
                    if (amount > 0) payments.push({ method: paymentLabels[key], amount });
                  });
                  return payments;
                })()}
              />
            </div>
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button onClick={() => setShowPreview(false)} className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold transition-colors">
                ปิด
              </button>
              <button onClick={handleGeneratePDF} disabled={loadingPDF}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50">
                {loadingPDF ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}