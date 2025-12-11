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
  const [kpiData, setKpiData] = useState<KPIData>({ totalValue: 0, productCount: 0 });
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
  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      console.log("━".repeat(60));
      console.log("🔄 Fetching inventory data...");
      console.log(`   Spreadsheet ID: ${spreadsheetId}`);
      console.log(`   Config Sheet: ${configSheetName}`);
      console.log(`   Data Sheet: ${dataSheetName}`);
      console.log("━".repeat(60));

      const params = new URLSearchParams({
        spreadsheetId,
        configSheetName,
        dataSheetName,
      });

      const fullUrl = `/api/dashboard/data?${params}`;
      console.log("🌐 Full API URL:", fullUrl);

      console.log("📤 Sending request...");
      const res = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("🔡 Response Status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
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
      console.log("━".repeat(60));

      setConfig(data.config);
      setAllData(data.data);

    } catch (err) {
      console.error("━".repeat(60));
      console.error("❌ Error fetching data:", err);
      console.error("━".repeat(60));
      setError(err instanceof Error ? err.message : "Unknown error");
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
      // Generate KPIs
      const kpi = generateInventoryKPI(allData, config);
      setKpiData(kpi);

      // Get low stock items
      const lowStock = getLowStockItems(allData, config);
      setLowStockItems(lowStock);

      // Generate product table
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
      // ✅ Show loading only on initial load
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI Cards */}
        <InventoryKPICards kpiData={kpiData} />

        {/* Low Stock Alert */}
        <LowStockAlert lowStockItems={lowStockItems} />

        {/* Product Table */}
        <InventoryProductTable products={productTableData} />
      </div>
    </div>
  );
}