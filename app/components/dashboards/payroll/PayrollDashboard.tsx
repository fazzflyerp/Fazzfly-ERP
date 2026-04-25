/**
 * Payroll Dashboard - Main Component (Same pattern as Sales Dashboard)
 * Location: app/components/dashboards/payroll/PayrollDashboard.tsx
 * ✅ FIXED: Year filter now properly reloads data (same as Sales)
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
  archiveFolderId?: string;
}

export default function PayrollDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  moduleName = "Payroll",
  archiveFolderId,
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
  // STATE: Year Filter
  // ============================================================
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<
    { year: string; spreadsheetId: string; fileName: string }[]
  >([]);
  const [loadingYears, setLoadingYears] = useState(false);

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
  const [otLeaders, setOTLeaders] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [performanceTable, setPerformanceTable] = useState<any[]>([]);

  // ============================================================
  // EFFECT: Validate props on mount
  // ============================================================
  useEffect(() => {

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
    } else {
    }
  }, [archiveFolderId]);

  // ============================================================
  // EFFECT: Fetch data when year changes
  // ============================================================
  useEffect(() => {

    // ✅ Normalize: "" or null = "Current"
    const normalizedYear = selectedYear?.trim() || null;


    // ✅ Fetch data every time selectedYear changes
    fetchDashboardData();
  }, [selectedYear]); // ✅ Trigger on ANY change to selectedYear

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
      
      // ✅ Debug: Check if archiveFolderId exists
      
      if (!archiveFolderId) {
        setLoadingYears(false);
        return;
      }

      let folderId = archiveFolderId.trim();


      if (folderId.includes("drive.google.com") || folderId.includes("https://")) {
        const match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          folderId = match[1];
        } else {
          setLoadingYears(false);
          return;
        }
      } else {
      }

      const params = new URLSearchParams({
        archiveFolderId: folderId,
        ...(moduleName && { moduleName }),
      });

      const fullUrl = `/api/dashboard/archive/years?${params}`;

      const res = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();

      if (data.years && data.years.length > 0) {
        data.years.forEach((y: any, i: number) => {
        });
      } else {
      }

      setAvailableYears(data.years || []);
    } catch (err: any) {
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


      // ✅ Normalize: treat "" as null
      const normalizedYear = selectedYear?.trim() || null;


      if (normalizedYear && availableYears.length > 0) {
        const found = availableYears.find((y) => y.year === normalizedYear);

        if (found) {

          params.append("year", normalizedYear);
          params.append("archiveSpreadsheetId", found.spreadsheetId);

        } else {
        }
      } else {
      }

      const fullUrl = `/api/dashboard/data?${params.toString()}`;

      const res = await fetch(fullUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data: DashboardData = await res.json();

      if (data.error) {
        throw new Error(data.error + (data.message ? `: ${data.message}` : ""));
      }

      if (!data.config || !data.data) {
        throw new Error("Invalid API response: missing config or data");
      }


      setConfig(data.config);
      setAllData(data.data);

      // Clear period selection when year changes
      setSelectedPeriods([]);

      // Generate visualizations
      generateVisualizations(data.data, [], data.config);
    } catch (err: any) {
      setError(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      // ✅ CRITICAL: Always set loading to false
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

    let filteredRows = rows;

    // Filter by period (client-side)
    if (periods.length > 0) {
      const periodField = configData.find((f) => f.type === "period");
      if (periodField) {
        const beforePeriod = filteredRows.length;
        filteredRows = filteredRows.filter((row) =>
          periods.includes(String(row[periodField.fieldName]).trim())
        );
      }
    }

    setFilteredData(filteredRows);
    setKpiData(generateKPI(filteredRows, configData));
    setPerformanceDistribution(generatePerformanceDistribution(filteredRows, configData));
    setOTLeaders(generateOTLeaders(filteredRows, configData));
    setAttendanceData(generateAttendanceData(filteredRows, configData));
    setPerformanceTable(generatePerformanceTable(filteredRows, configData));
  };

  // ============================================================
  // HANDLERS: Filter actions
  // ============================================================
  const handleYearChange = (year: string | null) => {
    setSelectedYear(year);
  };

  const handlePeriodToggle = (period: string) => {
    setSelectedPeriods((prev) => {
      const newSelection = prev.includes(period)
        ? prev.filter((p) => p !== period)
        : [...prev, period];
      return newSelection;
    });
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
      {/* Debug Info - Only in Development */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs">
          <p className="font-bold text-purple-900 mb-2">💼 Payroll Dashboard Debug:</p>
          <div className="grid grid-cols-2 gap-2 text-purple-800">
            <div>✅ Config: {config.length} fields</div>
            <div>✅ Data: {allData.length} rows</div>
            <div>📍 Periods: {selectedPeriods.length > 0 ? selectedPeriods.join(", ") : "(none)"}</div>
            <div>🔍 Filtered: {filteredData.length} rows</div>
            <div>👥 Employees: {new Set(allData.map((d) => d.employees_name)).size} unique</div>
            <div>📊 Performance: {performanceTable.length} scored</div>
            <div>
              📆 Year: {selectedYear || "Current"}
              {selectedYear && (
                <span className="ml-1 text-xs">
                  (Archive: {availableYears.find((y) => y.year === selectedYear)?.fileName || "?"})
                </span>
              )}
            </div>
            <div>📁 Archives: {availableYears.length} available</div>
            <div>🌐 Source: {selectedYear ? `Archive ${selectedYear}` : "Main Spreadsheet"}</div>
            <div>🔧 Loading: {loading ? "YES" : "NO"}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <PayrollFilters
        config={config}
        allData={allData}
        selectedYear={selectedYear}
        selectedPeriods={selectedPeriods}
        availableYears={availableYears}
        loadingYears={loadingYears}
        archiveFolderId={archiveFolderId}
        loading={loading}
        onYearChange={handleYearChange}
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

      {/* Charts (3 charts: Pie, OT Leaders Bar, Attendance Stacked Bar) */}
      <PayrollCharts
        performanceDistribution={performanceDistribution}
        otLeaders={otLeaders}
        attendanceData={attendanceData}
      />

      {/* Performance Table */}
      <PayrollPerformanceTable performanceTable={performanceTable} />
    </div>
  );
}