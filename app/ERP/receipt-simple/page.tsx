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

  // ✅ NEW: Detect if VAT is used
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

  // ✅ NEW: Company info & Preview modal
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // ✅ NEW: Sort & Filter states
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

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

      // Get client ID first
      const userModulesRes = await fetch("/api/user/modules", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userModulesRes.ok) {
        throw new Error("Failed to fetch user modules");
      }

      const userData = await userModulesRes.json();
      const clientId = userData.clientId;

      // Get documents
      const docsRes = await fetch(`/api/user/documents?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!docsRes.ok) {
        throw new Error("Failed to fetch documents");
      }

      const docsData = await docsRes.json();
      const module = docsData.documents.find((d: any) => d.moduleId === moduleId);

      if (!module) {
        throw new Error("Module not found");
      }

      setModuleInfo(module);
      console.log("✅ Module Info:", module);
      console.log("📁 Folder ID:", module.folderID);

      // Fetch config and transactions
      await Promise.all([
        fetchConfig(module.configName),
        fetchTransactions(module.sheetName),
        fetchCompanyInfo("company_info"), // ✅ ใช้ชื่อ sheet ตรงๆ
      ]);

    } catch (err: any) {
      console.error("❌ Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Fetch Company Info
  const fetchCompanyInfo = async (sheetName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/company-info?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`;

      console.log("🏢 Fetching company info from:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("⚠️ Could not fetch company info:", errorText);
        return;
      }

      const data = await response.json();
      console.log("✅ Company info loaded:", data.companyInfo);
      console.log("📋 Available fields:", Object.keys(data.companyInfo));
      
      // ✅ Log แต่ละ field
      console.log("   company_name:", data.companyInfo.company_name);
      console.log("   address:", data.companyInfo.address);
      console.log("   phone:", data.companyInfo.phone);
      console.log("   tax_id:", data.companyInfo.tax_id);
      console.log("   logo_url:", data.companyInfo.logo_url);
      
      setCompanyInfo(data.companyInfo);
    } catch (err: any) {
      console.warn("⚠️ Company info error:", err);
      // Non-critical, continue without company info
    }
  };

  // ✅ 2. Fetch Config
  const fetchConfig = async (configName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/config?spreadsheetId=${spreadsheetId}&configName=${configName}`;

      console.log("📋 Fetching config from:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch config");
      }

      const data = await response.json();
      console.log("✅ Config loaded:", data.fields.length, "fields");
      
      // ✅ Debug: แสดง field ทั้งหมดที่มี order
      const fieldsWithOrder = data.fields.filter((f: ConfigField) => f.order !== null);
      console.log("📋 Fields with order:", fieldsWithOrder.map((f: ConfigField) => ({
        name: f.fieldName,
        label: f.label,
        order: f.order,
        type: f.type
      })));
      
      setConfig(data.fields);
      
      // ✅ Check if VAT field exists and has order
      // ต้องเช็คชื่อ field ที่เป็น "vat" เท่านั้น (ไม่รวม cust_tax_no)
      const vatField = data.fields.find((f: ConfigField) => {
        const fieldNameLower = (f.fieldName || '').toLowerCase().trim();
        
        // ✅ เช็คเฉพาะชื่อที่เป็น vat โดยตรง
        const isVatField = fieldNameLower === 'vat';
        
        console.log(`   Checking: ${f.fieldName} (label: "${f.label}", order: ${f.order}) → ${isVatField ? '✅ Match' : '❌ No match'}`);
        
        return isVatField;
      });
      
      console.log("🔍 VAT field search result:");
      console.log("   Found field:", vatField);
      console.log("   Field name:", vatField?.fieldName);
      console.log("   Label:", vatField?.label);
      console.log("   Order:", vatField?.order);
      console.log("   Order type:", typeof vatField?.order);
      console.log("   Order !== null?", vatField?.order !== null);
      
      const hasVATEnabled = !!(vatField && vatField.order !== null && vatField.order !== undefined);
      setHasVAT(hasVATEnabled);
      
      console.log("💰 VAT Detection Result:", {
        vatField: vatField?.fieldName,
        order: vatField?.order,
        hasOrder: vatField?.order !== null,
        enabled: hasVATEnabled
      });
      
      console.log("🎯 Final hasVAT state:", hasVATEnabled);
    } catch (err: any) {
      console.error("❌ Config error:", err);
      throw err;
    }
  };

  // ✅ 3. Fetch Transactions
  const fetchTransactions = async (sheetName: string) => {
    try {
      const accessToken = (session as any)?.accessToken;
      const url = `/api/receipt/transactions?spreadsheetId=${spreadsheetId}&sheetName=${sheetName}`;

      console.log("📊 Fetching transactions from:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      console.log("✅ Transactions loaded:", data.count);
      setTransactions(data.transactions);
    } catch (err: any) {
      console.error("❌ Transactions error:", err);
      throw err;
    }
  };

  // ✅ 4. Map Transactions with Config และ Group by Receipt No
  useEffect(() => {
    if (config.length > 0 && transactions.length > 0) {
      console.log("=".repeat(60));
      console.log("🔄 MAPPING AND GROUPING TRANSACTIONS");
      console.log("=".repeat(60));
      
      // ✅ LOG ALL CONFIG FIELDS
      console.log("\n📋 ALL CONFIG FIELDS:");
      config.forEach((f, idx) => {
        console.log(`   ${idx + 1}. ${f.fieldName} (label: "${f.label}", order: ${f.order}, type: ${f.type})`);
      });
      console.log("");

      // ✅ LOG SAMPLE TRANSACTION DATA
      if (transactions.length > 0) {
        console.log("📊 SAMPLE TRANSACTION (first row):");
        console.log("   Raw data:", transactions[0].data.slice(0, 10));
        console.log("");
      }

      // ✅ Find receipt_no field - ปรับให้หาได้หลายแบบ
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

      console.log("🔍 Receipt number field found:", receiptNoField);

      if (!receiptNoField) {
        console.error("❌ Receipt number field not found in config");
        console.log("💡 Available fields:", config.map(f => ({ name: f.fieldName, label: f.label, order: f.order })));
        setGroupedReceipts([]);
        return;
      }

      if (receiptNoField.order === null) {
        console.error("❌ Receipt number field has no order (cannot map to column)");
        console.log("💡 Field info:", receiptNoField);
        setGroupedReceipts([]);
        return;
      }

      const receiptNoIndex = receiptNoField.order - 1;
      console.log(`✅ Using field: ${receiptNoField.fieldName} (order: ${receiptNoField.order}, column index: ${receiptNoIndex})`);

      // Map all transactions
      const mapped = transactions
        .map((transaction) => {
          const mappedData: MappedTransaction = {
            _rowIndex: transaction.rowIndex,
          };

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
          // ✅ กรองเฉพาะที่มีเลขที่ใบเสร็จ
          const receiptNo = t[receiptNoField.fieldName]?.toString().trim();
          return receiptNo && receiptNo !== "";
        });

      console.log(`✅ Filtered ${mapped.length} transactions with receipt numbers`);

      if (mapped.length === 0) {
        console.warn("⚠️ No transactions found with receipt numbers");
        setGroupedReceipts([]);
        setMappedTransactions([]);
        return;
      }

      // ✅ Group by receipt number
      const grouped = new Map<string, MappedTransaction[]>();

      mapped.forEach((transaction) => {
        const receiptNo = transaction[receiptNoField.fieldName]?.toString().trim();
        if (!grouped.has(receiptNo)) {
          grouped.set(receiptNo, []);
        }
        grouped.get(receiptNo)!.push(transaction);
      });

      // Convert to array
      const groupedArray: GroupedReceipt[] = Array.from(grouped.entries()).map(
        ([receiptNo, items]) => {
          const firstItem = items[0];
          
          // Find date, customer name, amount, and program fields
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
          const amountField = config.find((f) => 
            // ✅ ต้องเป็น "total_sales" เท่านั้น!
            f.fieldName === "total_sales"
          );
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

          console.log("\n🔍 FIELD MAPPING RESULTS:");
          console.log(`   ✓ Date field: ${dateField?.fieldName || "❌ NOT FOUND"} (order: ${dateField?.order})`);
          console.log(`   ✓ Customer field: ${customerField?.fieldName || "❌ NOT FOUND"} (order: ${customerField?.order})`);
          console.log(`   ✓ Amount field: ${amountField?.fieldName || "❌ NOT FOUND"} (order: ${amountField?.order})`);
          console.log(`   ✓ Program field: ${programField?.fieldName || "❌ NOT FOUND"} (order: ${programField?.order})`);
          console.log("");

          // ✅ DEBUG: Log sample item data to see actual values
          if (items.length > 0) {
            console.log("📋 FIRST ITEM - ALL FIELDS:");
            const firstItem = items[0];
            
            // Show ALL fields with values
            Object.keys(firstItem).sort().forEach(key => {
              const value = firstItem[key];
              const parsed = parseFloat(value);
              const isNumber = !isNaN(parsed) && parsed > 0;
              
              console.log(`   ${key}: "${value}" ${isNumber ? `← 💰 NUMERIC (${parsed})` : ''}`);
            });
            console.log("");
            
            if (amountField) {
              console.log(`💰 Using amount field: "${amountField.fieldName}" (order: ${amountField.order})`);
              console.log(`   Values in this receipt:`);
              items.forEach((item, idx) => {
                console.log(`   Item ${idx + 1}: "${item[amountField.fieldName]}"`);
              });
              console.log("");
            } else {
              console.log("❌ NO AMOUNT FIELD FOUND");
              console.log("");
            }
          }

          const totalAmount = items.reduce((sum, item, itemIdx) => {
            if (amountField) {
              const rawValue = item[amountField.fieldName];
              
              // Try to clean the value if it's a string with commas
              let cleanValue = rawValue;
              if (typeof rawValue === 'string') {
                cleanValue = rawValue.replace(/,/g, '').trim();
              }
              
              const amount = parseFloat(cleanValue || "0");
              
              if (itemIdx === 0) {
                console.log(`💵 CALCULATING TOTAL:`);
              }
              console.log(`   Item ${itemIdx + 1}: "${rawValue}" → cleaned: "${cleanValue}" → parsed: ${amount}`);
              
              return sum + (isNaN(amount) ? 0 : amount);
            }
            return sum;
          }, 0);

          console.log(`\n✅ RECEIPT ${receiptNo} FINAL TOTAL: ${totalAmount}`);
          console.log("=".repeat(60));
          console.log("");

          // Get all programs (unique)
          const programs = items
            .map(item => programField ? item[programField.fieldName] : "")
            .filter(p => p && p.toString().trim() !== "")
            .filter((p, index, self) => self.indexOf(p) === index); // unique

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

      // Sort by receipt number (descending)
      groupedArray.sort((a, b) => b.receiptNo.localeCompare(a.receiptNo));

      console.log(`✅ Grouped into ${groupedArray.length} receipts`);
      if (groupedArray.length > 0) {
        console.log("📋 Sample receipt:", {
          receiptNo: groupedArray[0].receiptNo,
          date: groupedArray[0].date,
          customer: groupedArray[0].customerName,
          items: groupedArray[0].items.length,
          total: groupedArray[0].totalAmount,
        });
      }
      
      setMappedTransactions(mapped);
      setGroupedReceipts(groupedArray);
    }
  }, [config, transactions]);

  // ✅ 5. Generate PDF and Upload to Google Drive (ใช้ Server-side API)
  const handleGeneratePDF = async () => {
    if (!selectedReceipt || !moduleInfo) return;

    try {
      setLoadingPDF(true);

      // ✅ เช็ค folderID
      const rootFolderId = moduleInfo.folderID || "1tmYuBv_65_4i9TER1O1VHCHyF89FLL3ZmMc6pTVZn8"; // ใส่ Folder ID ของคุณ
      
      if (!rootFolderId) {
        throw new Error("ไม่พบ Folder ID ใน client_receipt sheet กรุณาตรวจสอบคอลัมน์ folderID");
      }

      console.log("📁 Root Folder ID:", rootFolderId);

      // Helper: เอา comma ออกก่อน parse
      const parseNumber = (val: any) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/,/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      // Prepare data
      const pdfData = {
        hasVAT, // ✅ ส่ง flag ไปด้วย
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
          const vatAmount = beforeVat * (vatPercentage / 100);
          return sum + vatAmount;
        }, 0),
        total_after_vat: selectedReceipt.items.reduce((sum, item) => {
          const val = item.total_sales?.toString().replace(/,/g, '') || '0';
          return sum + parseFloat(val);
        }, 0),
        paymentMethods: (() => {
          const payments: Array<{method: string, amount: number}> = [];
          const paymentTotals: Record<string, number> = {
            payment_1: 0,
            payment_2: 0,
            payment_3: 0,
            payment_4: 0,
            payment_5: 0,
          };

          selectedReceipt.items.forEach(item => {
            Object.keys(paymentTotals).forEach(key => {
              const val = item[key]?.toString().replace(/,/g, '') || '0';
              const amount = parseFloat(val);
              if (!isNaN(amount)) {
                paymentTotals[key] += amount;
              }
            });
          });

          // Map ชื่อ payment จาก Config label
          const paymentLabels: Record<string, string> = {};
          
          // ✅ ดึง label จาก Config
          config.forEach((field) => {
            if (field.fieldName.startsWith('payment_')) {
              paymentLabels[field.fieldName] = field.label || field.fieldName;
            }
          });
          
          // ถ้าไม่มีใน config ให้ใช้ชื่อ field เลย
          if (Object.keys(paymentLabels).length === 0) {
            paymentLabels.payment_1 = "payment_1";
            paymentLabels.payment_2 = "payment_2";
            paymentLabels.payment_3 = "payment_3";
            paymentLabels.payment_4 = "payment_4";
            paymentLabels.payment_5 = "payment_5";
          }

          Object.entries(paymentTotals).forEach(([key, amount]) => {
            if (amount > 0) {
              payments.push({
                method: paymentLabels[key],
                amount: amount
              });
            }
          });

          return payments;
        })(),
      };

      // ✅ Generate PDF ผ่าน Server API (ใช้ HTML)
      console.log("📄 Generating PDF via API...");
      const accessToken = (session as any)?.accessToken;

      const pdfResponse = await fetch('/api/receipt/generate-pdf-html', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pdfData),
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        throw new Error(`PDF generation failed: ${errorText}`);
      }

      const blob = await pdfResponse.blob();
      console.log("✅ PDF generated successfully!");

      // Upload to Google Drive
      console.log("📤 Uploading to Google Drive...");

      const formData = new FormData();
      formData.append('file', blob, `${pdfData.receiptNo}_${pdfData.customerId}.pdf`);
      formData.append('receiptNo', pdfData.receiptNo);
      formData.append('customerId', pdfData.customerId);
      formData.append('date', pdfData.date);
      formData.append('rootFolderId', rootFolderId);

      const uploadResponse = await fetch('/api/receipt/upload-pdf', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.details || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      console.log("✅ Upload successful:", uploadResult);

      // Also download locally
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pdfData.receiptNo}_${pdfData.customerId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      // Success message
      alert(`✅ สร้างและบันทึก PDF สำเร็จ!\n\n📁 Folder: ${uploadResult.folderPath}\n📄 ไฟล์: ${uploadResult.fileName}\n\n🔗 ดูไฟล์: ${uploadResult.webViewLink}`);

    } catch (error: any) {
      console.error("❌ PDF Generation/Upload Error:", error);
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
          <Link
            href="/ERP/home"
            className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header - Green Theme */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-4">
              <Link
                href="/ERP/home"
                className="group flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 rounded-xl transition-all duration-300 border border-gray-200 shadow-sm"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-gray-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                  กลับ
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    ออกใบเสร็จรับเงิน
                  </h1>
                  {moduleInfo && (
                    <p className="text-sm text-gray-600 mt-0.5">
                      {moduleInfo.moduleName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="hidden md:flex items-center gap-4">
              <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-600 font-medium mb-0.5">ใบเสร็จทั้งหมด</div>
                <div className="text-xl font-bold text-emerald-700">
                  {groupedReceipts.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Left: Receipt List - 3 columns */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              {/* List Header with Sort & Filter */}
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

                {/* Sort & Filter Controls */}
                <div className="flex flex-wrap gap-2">
                  {/* Sort Buttons */}
                  <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                    <button
                      onClick={() => setSortOrder('newest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        sortOrder === 'newest'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        ใหม่ → เก่า
                      </span>
                    </button>
                    <button
                      onClick={() => setSortOrder('oldest')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        sortOrder === 'oldest'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        เก่า → ใหม่
                      </span>
                    </button>
                  </div>

                  {/* Month Filter */}
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
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
                        const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                        return (
                          <option key={m} value={m}>
                            {monthNames[parseInt(month) - 1]} {parseInt(year) + 543}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>

              {/* List Content */}
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
                      // Filter by month
                      .filter(receipt => {
                        if (selectedMonth === 'all') return true;
                        try {
                          const date = new Date(receipt.date.split('/').reverse().join('-'));
                          const month = date.getMonth() + 1;
                          const year = date.getFullYear();
                          return `${year}-${month.toString().padStart(2, '0')}` === selectedMonth;
                        } catch (e) {
                          return false;
                        }
                      })
                      // Sort by date
                      .sort((a, b) => {
                        try {
                          const dateA = new Date(a.date.split('/').reverse().join('-'));
                          const dateB = new Date(b.date.split('/').reverse().join('-'));
                          return sortOrder === 'newest' 
                            ? dateB.getTime() - dateA.getTime()
                            : dateA.getTime() - dateB.getTime();
                        } catch (e) {
                          return 0;
                        }
                      })
                      .map((receipt, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedReceipt(receipt)}
                        className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          selectedReceipt?.receiptNo === receipt.receiptNo
                            ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50"
                            : "border-gray-200 bg-white hover:border-emerald-300"
                        }`}
                      >
                        {/* Selected Indicator */}
                        {selectedReceipt?.receiptNo === receipt.receiptNo && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-teal-600"></div>
                        )}

                        <div className="p-5">
                          {/* Receipt Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  เลขที่
                                </span>
                                {selectedReceipt?.receiptNo === receipt.receiptNo && (
                                  <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                                    เลือกแล้ว
                                  </span>
                                )}
                              </div>
                              <div className="text-xl font-bold text-gray-800 mb-1">
                                {receipt.receiptNo}
                              </div>
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

                          {/* Receipt Info */}
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

                          {/* Items Count & Total */}
                          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">
                                {receipt.items.length} รายการ
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 mb-0.5">ยอดรวม</div>
                              <div className={`text-lg font-bold ${
                                receipt.totalAmount > 0 
                                  ? "text-emerald-600" 
                                  : "text-gray-400"
                              }`}>
                                {receipt.totalAmount > 0 
                                  ? `฿${receipt.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                                  : "ไม่มียอด"
                                }
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

          {/* Right: Preview & Generate - 2 columns */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden sticky top-24">
              {/* Preview Header */}
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
                    {/* Receipt Info Card */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-200">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-xs text-emerald-600 uppercase tracking-wide mb-1 font-medium">เลขที่ใบเสร็จ</div>
                          <div className="text-2xl font-bold text-gray-800">
                            {selectedReceipt.receiptNo}
                          </div>
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-100 border border-emerald-200 rounded-lg">
                          <div className="text-xs text-emerald-700 font-semibold">
                            {selectedReceipt.items.length} รายการ
                          </div>
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

                        {/* Programs */}
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

                    {/* Items List */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                          รายการสินค้า/บริการ
                        </h3>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {selectedReceipt.items.map((item, index) => {
                          // แสดง 3-4 fields สำคัญของแต่ละ item
                          const displayFields = config.filter(f => f.order !== null).slice(0, 4);
                          
                          return (
                            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-xs font-semibold text-emerald-600">
                                  #{index + 1}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Row {item._rowIndex}
                                </div>
                              </div>
                              
                              <div className="space-y-1.5">
                                {displayFields.map((field) => (
                                  <div key={field.fieldName} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">{field.label}:</span>
                                    <span className="font-semibold text-gray-800">
                                      {item[field.fieldName] || "-"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Total Summary */}
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-100 uppercase tracking-wide mb-1 font-medium">
                            ยอดรวมทั้งหมด
                          </div>
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

                    {/* Preview & Generate Buttons */}
                    <div className="space-y-3">
                      {/* Preview Button */}
                      <button
                        onClick={() => setShowPreview(true)}
                        className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-98"
                      >
                        <span className="flex items-center justify-center gap-3">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          พรีวิวใบเสร็จ
                        </span>
                      </button>

                      {/* Download PDF Button */}
                      <button
                        onClick={handleGeneratePDF}
                        disabled={loadingPDF}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                          loadingPDF
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl active:scale-98"
                        }`}
                      >
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

                    {/* Info Note */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-blue-700 font-semibold mb-1">
                            💡 คำแนะนำ
                          </p>
                          <p className="text-sm text-blue-600">
                            ระบบจะรวมทุกรายการที่มีเลขที่ใบเสร็จเดียวกันไว้ใน PDF เดียว
                          </p>
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

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(71, 85, 105, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
      `}</style>

      {/* ✅ NEW: Preview Modal */}
      {showPreview && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">
                ตัวอย่างใบเสร็จ
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Receipt Preview Content */}
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
                  // ✅ Helper: เอา comma ออกก่อน parse
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
                  
                  // คำนวณ VAT จาก before vat
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
                  const vatAmount = beforeVat * (vatPercentage / 100);
                  return sum + vatAmount;
                }, 0)}
                total_after_vat={selectedReceipt.items.reduce((sum, item) => {
                  const val = item.total_sales?.toString().replace(/,/g, '') || '0';
                  return sum + parseFloat(val);
                }, 0)}
                paymentMethods={(() => {
                  const payments: Array<{method: string, amount: number}> = [];
                  
                  // รวม payment จากทุก items
                  const paymentTotals: Record<string, number> = {
                    payment_1: 0,
                    payment_2: 0,
                    payment_3: 0,
                    payment_4: 0,
                    payment_5: 0,
                  };

                  // รวมยอดจากทุก items (เอา comma ออก)
                  selectedReceipt.items.forEach(item => {
                    Object.keys(paymentTotals).forEach(key => {
                      const val = item[key]?.toString().replace(/,/g, '') || '0';
                      const amount = parseFloat(val);
                      if (!isNaN(amount)) {
                        paymentTotals[key] += amount;
                      }
                    });
                  });

                  // Map ชื่อ payment จาก Config label
                  const paymentLabels: Record<string, string> = {};
                  
                  // ✅ ดึง label จาก Config
                  config.forEach((field) => {
                    if (field.fieldName.startsWith('payment_')) {
                      paymentLabels[field.fieldName] = field.label || field.fieldName;
                    }
                  });
                  
                  // ถ้าไม่มีใน config ให้ใช้ชื่อ field เลย
                  if (Object.keys(paymentLabels).length === 0) {
                    paymentLabels.payment_1 = "payment_1";
                    paymentLabels.payment_2 = "payment_2";
                    paymentLabels.payment_3 = "payment_3";
                    paymentLabels.payment_4 = "payment_4";
                    paymentLabels.payment_5 = "payment_5";
                  }

                  // เพิ่มเฉพาะที่มีค่า
                  Object.entries(paymentTotals).forEach(([key, amount]) => {
                    if (amount > 0) {
                      payments.push({
                        method: paymentLabels[key],
                        amount: amount
                      });
                    }
                  });

                  return payments;
                })()}
              />
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={handleGeneratePDF}
                disabled={loadingPDF}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                {loadingPDF ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}