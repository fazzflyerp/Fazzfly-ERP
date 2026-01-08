/**
 * Inventory Dashboard Component
 * Location: app/components/dashboards/inventory/InventoryDashboard.tsx
 * ✅ Main dashboard for stock/inventory management
 * ✅ No filters - shows all data
 */

"use client";

import React, { useEffect, useState } from "react";
import InventoryKPICards from "./InventoryKPICards";
import LowStockAlert from "./LowStockAlert";
import InventoryProductTable from "./InventoryProductTable";
import {
  ConfigField,
  KPIData,
  LowStockItem,
  ProductTableRow,
  generateInventoryKPI,
  getLowStockItems,
  generateProductTableData,
} from "./inventoryUtils";

interface InventoryDashboardProps {
  spreadsheetId: string;
  configSheetName: string;
  dataSheetName: string;
  accessToken: string;
  archiveFolderId?: string;
  moduleName: string;
}

export default function InventoryDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  archiveFolderId,
  moduleName,
}: InventoryDashboardProps) {
  // State
  const [config, setConfig] = useState<ConfigField[]>([]);
  const [allData, setAllData] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<KPIData>({ 
    totalValue: 0, 
    productCount: 0,
    lowStockCount: 0,
    criticalStockCount: 0,
    normalStockCount: 0
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [productTableData, setProductTableData] = useState<ProductTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config and data on mount
  useEffect(() => {
    if (accessToken && spreadsheetId) {
      fetchData();
    }
  }, [spreadsheetId, configSheetName, dataSheetName, accessToken]);

  // Process data when config or allData changes
  useEffect(() => {
    if (config.length > 0 && allData.length > 0) {
      processData();
    }
  }, [config, allData]);

  /**
   * Fetch configuration and data from API
   */
  async function fetchData(retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
      setLoading(true);
      setError(null);

      console.log("═".repeat(60));
      console.log(`📄 Fetching inventory data... (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
      console.log(`   Spreadsheet ID: ${spreadsheetId}`);
      console.log(`   Config Sheet: ${configSheetName}`);
      console.log(`   Data Sheet: ${dataSheetName}`);
      console.log("═".repeat(60));

      const params = new URLSearchParams({
        spreadsheetId,
        configSheetName,
        dataSheetName,
      });

      const fullUrl = `/api/dashboard/data?${params}`;
      console.log("🌐 Full API URL:", fullUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      console.log("📤 Sending request...");
      const res = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("📡 Response Status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
        
        if ((res.status === 500 || errorText.includes('timeout')) && retryCount < MAX_RETRIES) {
          console.log(`🔄 Retrying in 3 seconds... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return fetchData(retryCount + 1);
        }
        
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error + (data.message ? `: ${data.message}` : ""));
      }

      if (!data.config || !data.data) {
        throw new Error("Invalid API response: missing config or data");
      }

      console.log("✅ Data loaded successfully:");
      console.log("   Config fields:", data.config.length);
      console.log("   Data records:", data.data.length);
      console.log("═".repeat(60));

      setConfig(data.config);
      setAllData(data.data);

    } catch (err: any) {
      console.error("═".repeat(60));
      console.error("❌ Error fetching data:", err);
      console.error("═".repeat(60));
      
      if (err.name === 'AbortError') {
        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Timeout - Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return fetchData(retryCount + 1);
        }
        setError("Request timeout - Sheet อาจมีข้อมูลเยอะเกินไป กรุณาลองใหม่อีกครั้ง");
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * Process data to generate KPIs, alerts, and table
   */
  function processData() {
    console.log("🔄 Processing inventory data...");

    try {
      const kpi = generateInventoryKPI(allData, config);
      setKpiData(kpi);

      const lowStock = getLowStockItems(allData, config);
      setLowStockItems(lowStock);

      const tableData = generateProductTableData(allData, config);
      setProductTableData(tableData);

      console.log("✅ Data processing complete");
    } catch (err) {
      console.error("❌ Error processing data:", err);
      setError("เกิดข้อผิดพลาดในการประมวลผลข้อมูล");
    }
  }

  // ============================================================
  // UI: Loading state
  // ============================================================
  if (loading && allData.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล Inventory Dashboard...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // UI: Error state
  // ============================================================
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 font-semibold">❌ {error}</p>
      </div>
    );
  }

  // ============================================================
  // UI: Empty state
  // ============================================================
  if (config.length === 0 || allData.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-700 font-semibold">
          ⚠️ ไม่พบ config หรือข้อมูล
        </p>
      </div>
    );
  }

  // ============================================================
  // UI: Main Dashboard - FULL WIDTH (like Sales)
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Debug Info - Development Only */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
          <p className="font-bold text-blue-900 mb-2">🐛 Debug Info:</p>
          <div className="grid grid-cols-2 gap-2 text-blue-800">
            <div>✅ Config: {config.length} fields</div>
            <div>✅ Data: {allData.length} rows</div>
            <div>🔴 Critical: {kpiData.criticalStockCount}</div>
            <div>🟠 Low Stock: {kpiData.lowStockCount}</div>
            <div>🟢 Normal: {kpiData.normalStockCount}</div>
            <div>💰 Total Value: ฿{kpiData.totalValue.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <InventoryKPICards kpiData={kpiData} />

      {/* Low Stock Alert */}
      <LowStockAlert lowStockItems={lowStockItems} />

      {/* Product Table */}
      <InventoryProductTable products={productTableData} />
    </div>
  );
}