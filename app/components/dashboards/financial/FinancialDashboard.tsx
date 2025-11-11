/**
 * Financial Dashboard - Main Component
 * Location: app/components/dashboards/financial/FinancialDashboard.tsx
 * ✅ Complete financial reporting dashboard with 6 KPIs
 */

"use client";

import { useEffect, useState } from "react";
import FinancialFilters from "./FinancialFilters";
import FinancialKPICards from "./FinancialKPICards";
import FinancialCharts from "./FinancialCharts";
import FinancialSummaryTable from "./FinancialSummaryTable";
import {
  ConfigField,
  KPIData,
  generateKPI,
  generateStackedBarData,
  generateAreaChartData,
  generateGaugeData,
  generateSummaryTableData,
  getPeriodOptions,
} from "@/app/components/dashboards/financial/financialUtils";

interface DashboardData {
  config?: ConfigField[];
  data?: any[];
  error?: string;
  message?: string;
  metadata?: {
    source?: string;
    year?: string | null;
    totalRecords?: number;
  };
}

interface Props {
  spreadsheetId: string;
  configSheetName: string;
  dataSheetName: string;
  accessToken: string;
  archiveFolderId?: string;
  moduleName?: string;
}

export default function FinancialDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  archiveFolderId,
  moduleName = "Financial",
}: Props) {
  // ============================================================
  // STATE: Loading & Errors
  // ============================================================
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // STATE: Config & Raw Data
  // ============================================================
  const [config, setConfig] = useState<ConfigField[]>([]);
  const [allData, setAllData] = useState<any[]>([]);

  // ============================================================
  // STATE: Filters
  // ============================================================
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<
    { year: string; spreadsheetId: string; fileName: string }[]
  >([]);
  const [loadingYears, setLoadingYears] = useState(false);

  // ============================================================
  // STATE: Visualizations
  // ============================================================
  const [kpiData, setKpiData] = useState<{ [key: string]: KPIData }>({});
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [stackedBarData, setStackedBarData] = useState<any[]>([]);
  const [areaChartData, setAreaChartData] = useState<any[]>([]);
  const [gaugeValue, setGaugeValue] = useState<number>(0);
  const [summaryData, setSummaryData] = useState<any[]>([]);

  // ============================================================
  // EFFECT: Validate props on mount
  // ============================================================
  useEffect(() => {
    console.log("🎯 Financial Dashboard Props:");
    console.log("   spreadsheetId:", spreadsheetId ? `${spreadsheetId.substring(0, 20)}...` : "❌ MISSING");
    console.log("   configSheetName:", configSheetName || "❌ MISSING");
    console.log("   dataSheetName:", dataSheetName || "❌ MISSING");
    console.log("   moduleName:", moduleName);
    console.log("   archiveFolderId:", archiveFolderId || "(not provided)");

    if (!spreadsheetId || !configSheetName || !dataSheetName || !accessToken) {
      setError("❌ Missing required props");
    }
  }, []);

  // ============================================================
  // EFFECT: Fetch available years when archiveFolderId is available
  // ============================================================
  useEffect(() => {
    if (archiveFolderId) {
      fetchAvailableYears();
    }
  }, [archiveFolderId]);

  // ============================================================
  // EFFECT: Fetch data when year changes
  // ============================================================
  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear]);

  // ============================================================
  // EFFECT: Filter visualizations when periods change (NO API CALL)
  // ============================================================
  useEffect(() => {
    if (allData.length > 0 && config.length > 0) {
      generateVisualizations(allData, selectedPeriods, config);
    }
  }, [selectedPeriods, allData, config]);

  // ============================================================
  // API: Fetch Available Years
  // ============================================================
  const fetchAvailableYears = async () => {
    try {
      setLoadingYears(true);
      let folderId = (archiveFolderId || "").trim();

      if (folderId.includes("drive.google.com") || folderId.includes("https://")) {
        const match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          folderId = match[1];
        }
      }

      const params = new URLSearchParams({
        archiveFolderId: folderId,
        ...(moduleName && { moduleName }),
      });

      const res = await fetch(`/api/dashboard/archive/years?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setAvailableYears(data.years || []);
      }
    } catch (err: any) {
      console.error("Error fetching years:", err.message);
    } finally {
      setLoadingYears(false);
    }
  };

  // ============================================================
  // API: Fetch Dashboard Data
  // ============================================================
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        spreadsheetId,
        configSheetName,
        dataSheetName,
      });

      const normalizedYear = selectedYear?.trim() || null;

      if (normalizedYear && availableYears.length > 0) {
        const found = availableYears.find((y) => y.year === normalizedYear);
        if (found) {
          params.append("year", normalizedYear);
          params.append("archiveSpreadsheetId", found.spreadsheetId);
        }
      }

      const res = await fetch(`/api/dashboard/data?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: DashboardData = await res.json();

      if (data.error || !data.config || !data.data) {
        throw new Error(data.error || "Invalid response");
      }

      console.log("✅ Financial data loaded:", data.data.length, "rows");

      setConfig(data.config);
      setAllData(data.data);
      generateVisualizations(data.data, selectedPeriods, data.config);
    } catch (err: any) {
      console.error("❌ Error fetching financial data:", err.message);
      setError(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DATA: Generate all visualizations
  // ============================================================
  const generateVisualizations = (
    rows: any[],
    periods: string[],
    configData: ConfigField[] = config
  ) => {
    console.log("📊 Generating Financial visualizations");

    let filteredRows = rows;

    // Filter by period (client-side)
    if (periods.length > 0) {
      const periodField = configData.find((f) => f.type === "period");
      if (periodField) {
        filteredRows = filteredRows.filter((row) =>
          periods.includes(String(row[periodField.fieldName]).trim())
        );
      }
    }

    setFilteredData(filteredRows);
    setKpiData(generateKPI(filteredRows, configData));
    setStackedBarData(generateStackedBarData(filteredRows, configData));
    setAreaChartData(generateAreaChartData(filteredRows, configData));
    setGaugeValue(generateGaugeData(filteredRows, configData));
    setSummaryData(generateSummaryTableData(filteredRows));
  };

  // ============================================================
  // HANDLERS: Filter actions
  // ============================================================
  const handlePeriodToggle = (period: string) => {
    setSelectedPeriods((prev) =>
      prev.includes(period)
        ? prev.filter((p) => p !== period)
        : [...prev, period]
    );
  };

  const handleSelectAll = (periodOptions: string[]) => {
    const newSelection =
      selectedPeriods.length === periodOptions.length ? [] : periodOptions;
    setSelectedPeriods(newSelection);
  };

  const handleClearFilters = () => {
    setSelectedYear(null);
    setSelectedPeriods([]);
  };

  // ============================================================
  // UI: Loading state
  // ============================================================
  if (loading && allData.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล Financial Dashboard...</p>
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
        <p className="text-yellow-700 font-semibold">⚠️ ไม่พบ config หรือข้อมูล</p>
      </div>
    );
  }

  const periodOptions = getPeriodOptions(allData, config);

  // ============================================================
  // UI: Main render
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
        <p className="font-bold text-green-900 mb-2">💰 Financial Dashboard Debug:</p>
        <div className="grid grid-cols-2 gap-2 text-green-800">
          <div>✅ Config: {config.length} fields</div>
          <div>✅ Data: {allData.length} rows</div>
          <div>📍 Periods: {selectedPeriods.length > 0 ? selectedPeriods.join(", ") : "(none)"}</div>
          <div>🔍 Filtered: {filteredData.length} rows</div>
          <div>📆 Year: {selectedYear || "Current"}</div>
          <div>📁 Archives: {availableYears.length} available</div>
        </div>
      </div>

      {/* Filters */}
      <FinancialFilters
        config={config}
        allData={allData}
        selectedYear={selectedYear}
        selectedPeriods={selectedPeriods}
        availableYears={availableYears}
        loadingYears={loadingYears}
        archiveFolderId={archiveFolderId}
        loading={loading}
        onYearChange={setSelectedYear}
        onPeriodToggle={handlePeriodToggle}
        onSelectAll={handleSelectAll}
        onClearFilters={handleClearFilters}
      />

      {/* KPI Cards (6 cards) */}
      <FinancialKPICards
        kpiData={kpiData}
        allData={allData}
        filteredData={filteredData}
        config={config}
        selectedPeriods={selectedPeriods}
      />

      {/* Charts (Stacked Bar + Area + Gauge) */}
      <FinancialCharts
        stackedBarData={stackedBarData}
        areaChartData={areaChartData}
        gaugeValue={gaugeValue}
      />

      {/* Summary Table */}
      <FinancialSummaryTable summaryData={summaryData} />
    </div>
  );
}