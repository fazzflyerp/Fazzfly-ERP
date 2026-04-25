/**
 * Expense Dashboard - Main Component (FIXED - Debug only in dev)
 * Location: app/components/dashboards/expense/ExpenseDashboard.tsx
 * ✅ Customized for Expense module with fields: period, date, expense, amount
 * ✅ FIXED: Debug info only shows in development mode
 */

"use client";

import { useEffect, useState } from "react";
import ExpenseFilters from "./ExpenseFilters";
import ExpenseKPICards from "./ExpenseKPICards";
import ExpenseCharts from "./ExpenseCharts";
import ExpenseRanking from "./ExpenseRanking";
import {
  ConfigField,
  KPIData,
  generateKPI,
  generateLineChartData,
  generateRankingTableData,
  generatePieChartData,
  getPeriodOptions,
  normalizeDate,
} from "@/app/components/dashboards/expense/expenseUtils";

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

export default function ExpenseDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  archiveFolderId,
  moduleName = "Expense",
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
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableYears, setAvailableYears] = useState<
    { year: string; spreadsheetId: string; fileName: string }[]
  >([]);
  const [loadingYears, setLoadingYears] = useState(false);

  // ============================================================
  // STATE: Visualizations
  // ============================================================
  const [kpiData, setKpiData] = useState<{ [key: string]: KPIData }>({});
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [lineChartData, setLineChartData] = useState<any[]>([]);
  const [rankingTableData, setRankingTableData] = useState<any[]>([]);
  const [pieChartData, setPieChartData] = useState<any[]>([]);

  // ============================================================
  // EFFECT: Validate props on mount
  // ============================================================
  useEffect(() => {

    if (!spreadsheetId || !configSheetName || !dataSheetName || !accessToken) {
      setError(
        "❌ Missing required props: spreadsheetId, configSheetName, dataSheetName, or accessToken"
      );
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

    const normalizedYear = selectedYear?.trim() || null;


    fetchDashboardData();
  }, [selectedYear]);

  // ============================================================
  // EFFECT: Reset date when periods change
  // ============================================================
  useEffect(() => {
    setSelectedDate("");
  }, [selectedPeriods]);

  // ============================================================
  // EFFECT: Filter visualizations when periods/date change (NO API CALL)
  // ============================================================
  useEffect(() => {

    if (allData.length > 0 && config.length > 0) {
      generateVisualizations(allData, selectedPeriods, config);
    }
  }, [selectedPeriods, selectedDate, allData, config]);

  // ============================================================
  // API: Fetch Available Years
  // ============================================================
  const fetchAvailableYears = async () => {
    try {

      setLoadingYears(true);
      let folderId = (archiveFolderId || "").trim();


      if (
        folderId.includes("drive.google.com") ||
        folderId.includes("https://")
      ) {
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


      const res = await fetch(`/api/dashboard/archive/years?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });


      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.years && data.years.length > 0) {
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
        throw new Error(
          data.error + (data.message ? `: ${data.message}` : "")
        );
      }

      if (!data.config || !data.data) {
        throw new Error("Invalid API response: missing config or data");
      }

      data.config.forEach((f, i) => {
      });
      if (data.data.length > 0) {
      }

      setConfig(data.config);
      setAllData(data.data);

      generateVisualizations(data.data, selectedPeriods, data.config);
    } catch (err: any) {
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

    let filteredRows = rows;

    // ✅ Filter by period (client-side)
    if (periods.length > 0) {
      const periodField = configData.find((f) => f.type === "period");
      if (periodField) {
        const beforePeriod = filteredRows.length;
        filteredRows = filteredRows.filter((row) =>
          periods.includes(String(row[periodField.fieldName]).trim())
        );
      }
    }

    // ✅ Filter by date (client-side)
    if (selectedDate) {
      const dateField = configData.find((f) => f.type === "date");
      if (dateField) {
        const beforeDate = filteredRows.length;
        const targetDate = normalizeDate(selectedDate);

        filteredRows = filteredRows.filter((row) => {
          const rawDate = String(row[dateField.fieldName] || "").trim();
          if (!rawDate) return false;
          const normalizedRowDate = normalizeDate(rawDate);
          return normalizedRowDate === targetDate;
        });
      }
    }

    setFilteredData(filteredRows);
    setKpiData(generateKPI(filteredRows, configData));
    setLineChartData(generateLineChartData(filteredRows, configData));
    setRankingTableData(generateRankingTableData(filteredRows));
    setPieChartData(generatePieChartData(filteredRows));
  };

  // ============================================================
  // HANDLERS: Filter actions
  // ============================================================
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
    setSelectedDate("");
    setSelectedPeriods([]);
  };

  // ============================================================
  // UI: Loading state
  // ============================================================
  if (loading && allData.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล Expense Dashboard...</p>
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

  const periodOptions = getPeriodOptions(allData, config);

  // ============================================================
  // UI: Main render
  // ============================================================
  return (
    <div className="space-y-6">
      {/* Debug: Show current state (Only in Development) */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
          <p className="font-bold text-red-900 mb-2">💸 Expense Dashboard Debug:</p>
          <div className="grid grid-cols-2 gap-2 text-red-800">
            <div>✅ Config: {config.length} fields</div>
            <div>✅ Data: {allData.length} rows</div>
            <div>
              📍 Periods:{" "}
              {selectedPeriods.length > 0 ? selectedPeriods.join(", ") : "(none)"}
            </div>
            <div>📅 Date: {selectedDate || "(all)"}</div>
            <div>🔍 Filtered: {filteredData.length} rows</div>
            <div>
              📆 Year: {selectedYear || "Current"}
              {selectedYear && (
                <span className="ml-1 text-xs">
                  (Archive: {availableYears.find((y) => y.year === selectedYear)?.fileName || "?"})
                </span>
              )}
            </div>
            <div>📁 Archives: {availableYears.length} available</div>
            <div>
              🌐 Source:{" "}
              {selectedYear
                ? `Archive ${selectedYear}`
                : "Main Spreadsheet"}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <ExpenseFilters
        config={config}
        allData={allData}
        selectedYear={selectedYear}
        selectedPeriods={selectedPeriods}
        selectedDate={selectedDate}
        availableYears={availableYears}
        loadingYears={loadingYears}
        archiveFolderId={archiveFolderId}
        loading={loading}
        onYearChange={(year) => {
          setSelectedYear(year);
        }}
        onPeriodToggle={handlePeriodToggle}
        onSelectAll={handleSelectAll}
        onDateChange={(date) => setSelectedDate(date)}
        onClearFilters={handleClearFilters}
        onDefaultPeriodReady={(period) => {
        }}
      />

      {/* KPI Cards */}
      <ExpenseKPICards
        kpiData={kpiData}
        allData={allData}
        filteredData={filteredData}
        config={config}
        selectedPeriods={selectedPeriods}
      />

      {/* Charts */}
      <ExpenseCharts
        pieChartData={pieChartData}
        lineChartData={lineChartData}
      />

      {/* Ranking */}
      <ExpenseRanking rankingTableData={rankingTableData} />
    </div>
  );
}