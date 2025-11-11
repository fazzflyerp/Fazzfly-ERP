/**
 * Payroll Dashboard - Main Component
 * Location: app/components/dashboards/payroll/PayrollDashboard.tsx
 * ✅ Complete payroll dashboard with 6 KPIs + Performance Scoring
 */

"use client";

import { useEffect, useState } from "react";
import PayrollFilters from "./PayrollFilters";
import PayrollKPICards from "./PayrollKPICards";
import PayrollCharts from "./PayrollCharts";
import PayrollPerformanceTable from "./PayrollPerformanceTable";
import {
  ConfigField,
  KPIData,
  generateKPI,
  generatePerformanceDistribution,
  generateTopPerformers,
  generateOTLeaders,
  generateAttendanceData,
  generatePerformanceTable,
  getPeriodOptions,
} from "@/app/components/dashboards/payroll/payrollUtils";

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
  moduleName?: string;
}

export default function PayrollDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  moduleName = "Payroll",
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

  // ============================================================
  // STATE: Visualizations
  // ============================================================
  const [kpiData, setKpiData] = useState<{ [key: string]: KPIData }>({});
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [performanceDistribution, setPerformanceDistribution] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [otLeaders, setOTLeaders] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [performanceTable, setPerformanceTable] = useState<any[]>([]);

  // ============================================================
  // EFFECT: Validate props on mount
  // ============================================================
  useEffect(() => {
    console.log("🎯 Payroll Dashboard Props:");
    console.log("   spreadsheetId:", spreadsheetId ? `${spreadsheetId.substring(0, 20)}...` : "❌ MISSING");
    console.log("   configSheetName:", configSheetName || "❌ MISSING");
    console.log("   dataSheetName:", dataSheetName || "❌ MISSING");
    console.log("   moduleName:", moduleName);

    if (!spreadsheetId || !configSheetName || !dataSheetName || !accessToken) {
      setError("❌ Missing required props");
    }
  }, []);

  // ============================================================
  // EFFECT: Fetch data on mount
  // ============================================================
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ============================================================
  // EFFECT: Filter visualizations when periods change (NO API CALL)
  // ============================================================
  useEffect(() => {
    if (allData.length > 0 && config.length > 0) {
      generateVisualizations(allData, selectedPeriods, config);
    }
  }, [selectedPeriods, allData, config]);

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

      console.log("✅ Payroll data loaded:", data.data.length, "rows");

      setConfig(data.config);
      setAllData(data.data);
      generateVisualizations(data.data, selectedPeriods, data.config);
    } catch (err: any) {
      console.error("❌ Error fetching payroll data:", err.message);
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
    console.log("📊 Generating Payroll visualizations");

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
    setPerformanceDistribution(generatePerformanceDistribution(filteredRows, configData));
    setTopPerformers(generateTopPerformers(filteredRows, configData));
    setOTLeaders(generateOTLeaders(filteredRows, configData));
    setAttendanceData(generateAttendanceData(filteredRows, configData));
    setPerformanceTable(generatePerformanceTable(filteredRows, configData));
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
    setSelectedPeriods([]);
  };

  // ============================================================
  // UI: Loading state
  // ============================================================
  if (loading && allData.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล Payroll Dashboard...</p>
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
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs">
        <p className="font-bold text-purple-900 mb-2">💼 Payroll Dashboard Debug:</p>
        <div className="grid grid-cols-2 gap-2 text-purple-800">
          <div>✅ Config: {config.length} fields</div>
          <div>✅ Data: {allData.length} rows</div>
          <div>📍 Periods: {selectedPeriods.length > 0 ? selectedPeriods.join(", ") : "(none)"}</div>
          <div>🔍 Filtered: {filteredData.length} rows</div>
          <div>👥 Employees: {new Set(allData.map((d) => d.employees_name)).size} unique</div>
          <div>📊 Performance: {performanceTable.length} scored</div>
        </div>
      </div>

      {/* Filters */}
      <PayrollFilters
        config={config}
        allData={allData}
        selectedPeriods={selectedPeriods}
        loading={loading}
        onPeriodToggle={handlePeriodToggle}
        onSelectAll={handleSelectAll}
        onClearFilters={handleClearFilters}
      />

      {/* KPI Cards (6 cards: Salary, Commission, Staff Fees, Leave, Late, OT) */}
      <PayrollKPICards
        kpiData={kpiData}
        allData={allData}
        filteredData={filteredData}
        config={config}
        selectedPeriods={selectedPeriods}
      />

      {/* Charts (4 charts: Pie, Bar, Bar, Stacked Bar) */}
      <PayrollCharts
        performanceDistribution={performanceDistribution}
        topPerformers={topPerformers}
        otLeaders={otLeaders}
        attendanceData={attendanceData}
      />

      {/* Performance Table */}
      <PayrollPerformanceTable performanceTable={performanceTable} />
    </div>
  );
}