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
  const [searchTerm, setSearchTerm] = useState<string>('');

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
    <div className="min-h-screen bg-slate-50">
      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <QuickNavTrigger onClick={() => setNavOpen(true)} />
            <Link href="/ERP/home" className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-sm font-bold text-slate-800 truncate">ใบเสร็จรับเงิน</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500 font-semibold hidden sm:block">{groupedReceipts.length} รายการ</span>
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

        {/* Left: Receipt List */}
        <div className="flex flex-col border-r border-slate-200 overflow-hidden">
          {/* Filters */}
          <div className="flex-none px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setSortOrder('newest')}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortOrder === 'newest' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                ใหม่→เก่า
              </button>
              <button onClick={() => setSortOrder('oldest')}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortOrder === 'oldest' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                เก่า→ใหม่
              </button>
            </div>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500">
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
            <input type="text" placeholder="ค้นหา..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[80px] px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"/>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {groupedReceipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">ไม่มีรายการใบเสร็จ</p>
              </div>
            ) : groupedReceipts
              .filter(receipt => {
                if (selectedMonth !== 'all') {
                  try {
                    const date = new Date(receipt.date.split('/').reverse().join('-'));
                    const month = date.getMonth() + 1;
                    const year = date.getFullYear();
                    if (`${year}-${month.toString().padStart(2, '0')}` !== selectedMonth) return false;
                  } catch (e) { return false; }
                }
                if (searchTerm) {
                  const term = searchTerm.toLowerCase();
                  return (
                    receipt.receiptNo.toLowerCase().includes(term) ||
                    receipt.customerName.toLowerCase().includes(term) ||
                    receipt.programs.toLowerCase().includes(term)
                  );
                }
                return true;
              })
              .sort((a, b) => {
                try {
                  const dateA = new Date(a.date.split('/').reverse().join('-'));
                  const dateB = new Date(b.date.split('/').reverse().join('-'));
                  return sortOrder === 'newest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
                } catch (e) { return 0; }
              })
              .map((receipt, index) => {
                const isSelected = selectedReceipt?.receiptNo === receipt.receiptNo;
                return (
                  <div key={index} onClick={() => setSelectedReceipt(receipt)}
                    className={`rounded-xl border cursor-pointer transition-all px-3 py-2.5 ${
                      isSelected ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40'}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-800">{receipt.receiptNo}</span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{receipt.date}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mb-1.5">{receipt.customerName || "ไม่ระบุชื่อ"}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 truncate flex-1 mr-2">{receipt.programs}</span>
                      <span className={`text-[11px] font-bold flex-shrink-0 ${receipt.totalAmount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {receipt.totalAmount > 0 ? `฿${receipt.totalAmount.toLocaleString('th-TH', { maximumFractionDigits: 0 })}` : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right: Detail + Actions */}
        <div className="flex flex-col overflow-hidden bg-slate-50">
          {!selectedReceipt ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium">เลือกใบเสร็จเพื่อดูรายละเอียด</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex-none px-3 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">เลขที่</p>
                    <p className="text-base font-bold text-slate-800">{selectedReceipt.receiptNo}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-400">ยอดรวม</p>
                    <p className="text-base font-bold text-emerald-600">฿{selectedReceipt.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-2.5">
                  <div><span className="text-slate-400">วันที่: </span>{selectedReceipt.date || '-'}</div>
                  <div><span className="text-slate-400">ลูกค้า: </span><span className="font-semibold">{selectedReceipt.customerName || '-'}</span></div>
                  <div className="col-span-2 truncate"><span className="text-slate-400">บริการ: </span>{selectedReceipt.programs}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowPreview(true)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    พรีวิว
                  </button>
                  <button onClick={handleGeneratePDF} disabled={loadingPDF}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                    {loadingPDF ? (
                      <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>กำลังสร้าง...</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>ดาวน์โหลด PDF</>
                    )}
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {selectedReceipt.items.map((item, index) => {
                  const displayFields = config.filter(f => f.order !== null).slice(0, 5);
                  return (
                    <div key={index} className="bg-white rounded-xl border border-slate-200 px-3 py-2">
                      <div className="text-[10px] font-bold text-emerald-600 mb-1.5">#{index + 1}</div>
                      <div className="space-y-1">
                        {displayFields.map((field, fi) => (
                          <div key={`${field.fieldName}-${fi}`} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">{field.label}</span>
                            <span className="font-semibold text-slate-700">{item[field.fieldName] || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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