/**
 * Sales Dashboard - Main Component
 * Location: app/components/dashboards/sales/SalesDashboard.tsx
 * ✅ FIXED: Year filter now properly reloads data
 */

"use client";

import { useEffect, useState } from "react";
import SalesFilters from "./SalesFilters";
import SalesKPICards from "./SalesKPICards";
import SalesCharts from "./SalesCharts";
import SalesRanking from "./SalesRanking";
import {
  ConfigField,
  KPIData,
  generateKPI,
  generateLineChartData,
  generateRankingTableData,
  generatePieChartData,
  generateWaterfallData,
  getPeriodOptions,
  normalizeDate,
} from "./salesUtils";

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

export default function SalesDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  archiveFolderId,
  moduleName = "Sales",
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
  const [waterfallData, setWaterfallData] = useState<any[]>([]);

  // ============================================================
  // EFFECT: Validate props on mount
  // ============================================================
  useEffect(() => {
    console.log("🎯 Component Props:");
    console.log(
      "   spreadsheetId:",
      spreadsheetId ? `${spreadsheetId.substring(0, 20)}...` : "❌ MISSING"
    );
    console.log("   configSheetName:", configSheetName || "❌ MISSING");
    console.log("   dataSheetName:", dataSheetName || "❌ MISSING");
    console.log(
      "   accessToken:",
      accessToken ? `${accessToken.substring(0, 20)}...` : "❌ MISSING"
    );
    console.log("   moduleName:", moduleName);
    console.log("   archiveFolderId:", archiveFolderId || "(not provided)");

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
      console.log("📁 archiveFolderId is set:", archiveFolderId);
      fetchAvailableYears();
    } else {
      console.log("ℹ️  No archiveFolderId - year filter disabled");
    }
  }, [archiveFolderId]);

  // ============================================================
  // EFFECT: Fetch data when year changes
  // ============================================================
  useEffect(() => {
    console.log("━".repeat(60));
    console.log("🔄 [Data Fetch Effect] Triggered");

    // ✅ Normalize: "" or null = "Current"
    const normalizedYear = selectedYear?.trim() || null;

    console.log("   selectedYear (raw):", selectedYear);
    console.log("   selectedYear (normalized):", normalizedYear || "Current");
    console.log("   availableYears.length:", availableYears.length);
    console.log("━".repeat(60));

    // ✅ Fetch data every time selectedYear changes
    // - null/"" = current year (main spreadsheet)
    // - "2024" = archive year (archive spreadsheet)
    fetchDashboardData();
  }, [selectedYear]); // ✅ Trigger on ANY change to selectedYear

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
    console.log("🔄 Filters changed - regenerating visualizations");
    console.log("   Periods:", selectedPeriods.length > 0 ? selectedPeriods : "all");
    console.log("   Date:", selectedDate || "all");

    if (allData.length > 0 && config.length > 0) {
      generateVisualizations(allData, selectedPeriods, config);
    }
  }, [selectedPeriods, selectedDate, allData, config]);

  // ============================================================
  // API: Fetch Available Years
  // ============================================================
  const fetchAvailableYears = async () => {
    try {
      console.log("━".repeat(60));
      console.log("📅 [fetchAvailableYears] START");
      console.log("━".repeat(60));

      setLoadingYears(true);
      let folderId = (archiveFolderId || "").trim();

      console.log("📁 Input archiveFolderId:", folderId);

      if (
        folderId.includes("drive.google.com") ||
        folderId.includes("https://")
      ) {
        console.log("🔗 Detected URL format, extracting ID...");
        const match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          folderId = match[1];
          console.log("✅ Extracted Folder ID:", folderId);
        } else {
          console.error("❌ Cannot extract Folder ID from URL");
          setLoadingYears(false);
          return;
        }
      } else {
        console.log("🆔 Already in ID format:", folderId);
      }

      const params = new URLSearchParams({
        archiveFolderId: folderId,
        ...(moduleName && { moduleName }),
      });

      console.log("🌐 API URL:", `/api/dashboard/archive/years?${params}`);
      if (moduleName) {
        console.log("📦 Module Name:", moduleName);
      }

      const res = await fetch(`/api/dashboard/archive/years?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      console.log("✅ [fetchAvailableYears] Success:");
      console.log("   Years found:", data.years?.length || 0);
      if (data.years && data.years.length > 0) {
        console.log("   Years:", data.years.map((y: any) => y.year).join(", "));
        data.years.forEach((y: any) => {
          console.log(`   - ${y.year}: ${y.fileName} (${y.spreadsheetId})`);
        });
      }
      console.log("━".repeat(60));

      setAvailableYears(data.years || []);
    } catch (err: any) {
      console.error("━".repeat(60));
      console.error("❌ [fetchAvailableYears] Error:", err.message);
      console.error("━".repeat(60));
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

      console.log("━".repeat(60));
      console.log("📊 [fetchDashboardData] START");
      console.log("━".repeat(60));

      const params = new URLSearchParams({
        spreadsheetId,
        configSheetName,
        dataSheetName,
      });

      console.log("📋 Initial params:");
      console.log("   spreadsheetId:", spreadsheetId);
      console.log("   configSheetName:", configSheetName);
      console.log("   dataSheetName:", dataSheetName);

      // ✅ Normalize: treat "" as null
      const normalizedYear = selectedYear?.trim() || null;

      console.log("🔍 Year filter check:");
      console.log("   selectedYear (raw):", selectedYear);
      console.log("   normalizedYear:", normalizedYear || "Current");
      console.log("   availableYears.length:", availableYears.length);

      if (normalizedYear && availableYears.length > 0) {
        console.log("🔎 Looking for archive spreadsheet...");
        const found = availableYears.find((y) => y.year === normalizedYear);

        if (found) {
          console.log("✅ Found archive spreadsheet:");
          console.log("   Year:", found.year);
          console.log("   SpreadsheetId:", found.spreadsheetId);
          console.log("   FileName:", found.fileName);

          params.append("year", normalizedYear);
          params.append("archiveSpreadsheetId", found.spreadsheetId);

          console.log("📦 Added to params:");
          console.log("   year:", normalizedYear);
          console.log("   archiveSpreadsheetId:", found.spreadsheetId);
        } else {
          console.warn("⚠️ Archive not found for year:", normalizedYear);
        }
      } else {
        console.log("ℹ️  No year filter (will use main spreadsheet)");
        if (normalizedYear) {
          console.log("   (normalizedYear is set but availableYears is empty)");
        }
      }

      const fullUrl = `/api/dashboard/data?${params.toString()}`;
      console.log("🌐 API URL:", fullUrl);

      const res = await fetch(fullUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ API Error:", errorText);
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

      // ✅ เพิ่ม Debug ตรงนี้
      console.log("━".repeat(60));
      console.log("📦 [API Response Debug]");
      console.log("   Config fields:", data.config.length);
      console.log("   Config detail:");
      data.config.forEach((f, i) => {
        console.log(`      [${i}] ${f.fieldName} (type: ${f.type}, label: ${f.label})`);
      });
      console.log("   Data records:", data.data.length);
      if (data.data.length > 0) {
        console.log("   Sample data keys:", Object.keys(data.data[0]));
        console.log("   Sample data[0]:", data.data[0]);
      }
      console.log("   Metadata:", data.metadata);
      console.log("   Year requested:", selectedYear || "Current");
      console.log("━".repeat(60));

      console.log("✅ [fetchDashboardData] Success:");
      console.log("   Config fields:", data.config.length);
      console.log("   Data records:", data.data.length);
      console.log("   Metadata:", data.metadata);
      console.log("━".repeat(60));

      setConfig(data.config);
      setAllData(data.data);

      // Generate visualizations with current filters
      generateVisualizations(data.data, selectedPeriods, data.config);
    } catch (err: any) {
      console.error("━".repeat(60));
      console.error("❌ [fetchDashboardData] Error:", err.message);
      console.error("━".repeat(60));
      setError(err.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      // ✅ CRITICAL: Always set loading to false
      console.log("✅ Setting loading = false");
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
    console.log(
      `📊 Generating visualizations (CLIENT-SIDE ONLY):`,
      `periods=${periods.length > 0 ? periods.join(",") : "all"}`,
      `date=${selectedDate || "all"}`
    );

    let filteredRows = rows;

    // ✅ Filter by period (client-side)
    if (periods.length > 0) {
      const periodField = configData.find((f) => f.type === "period");
      if (periodField) {
        const beforePeriod = filteredRows.length;
        filteredRows = filteredRows.filter((row) =>
          periods.includes(String(row[periodField.fieldName]).trim())
        );
        console.log(
          `   📍 Period: ${beforePeriod} → ${filteredRows.length} records`
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
        console.log(
          `   📅 Date: ${beforeDate} → ${filteredRows.length} records (${selectedDate} = ${targetDate})`
        );
      }
    }

    setFilteredData(filteredRows);
    setKpiData(generateKPI(filteredRows, configData));
    setLineChartData(generateLineChartData(filteredRows, configData));
    setRankingTableData(generateRankingTableData(filteredRows));
    setPieChartData(generatePieChartData(filteredRows));
    setWaterfallData(generateWaterfallData(filteredRows));
  };

  // ============================================================
  // HANDLERS: Filter actions
  // ============================================================
  const handlePeriodToggle = (period: string) => {
    console.log("🔘 Period toggle clicked:", period);
    setSelectedPeriods((prev) => {
      const newSelection = prev.includes(period)
        ? prev.filter((p) => p !== period)
        : [...prev, period];
      console.log("   📊 New selection:", newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = (periodOptions: string[]) => {
    const newSelection =
      selectedPeriods.length === periodOptions.length ? [] : periodOptions;
    setSelectedPeriods(newSelection);
  };

  const handleClearFilters = () => {
    console.log("🔄 Clearing all filters");
    setSelectedYear(null);
    setSelectedDate("");
    setSelectedPeriods([]);
  };

  // ============================================================
  // UI: Loading state
  // ============================================================
  if (loading && allData.length === 0) {
    // ✅ Show loading only on initial load
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลดข้อมูล Sales Dashboard...</p>
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
      {/* Debug: Show current state - ONLY IN DEVELOPMENT */}
      {process.env.NODE_ENV === "development" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
          <p className="font-bold text-blue-900 mb-2">🐛 Debug Info:</p>
          <div className="grid grid-cols-2 gap-2 text-blue-800">
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
            <div>
              🔧 Loading: {loading ? "YES" : "NO"}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <SalesFilters
        config={config}
        allData={allData}
        selectedYear={selectedYear}
        selectedPeriods={selectedPeriods}
        selectedDate={selectedDate}
        availableYears={availableYears}
        loadingYears={loadingYears}
        archiveFolderId={archiveFolderId}
        loading={loading} // ✅ Pass loading state
        onYearChange={(year) => {
          console.log("━".repeat(60));
          console.log("📅 [onYearChange] Year filter changed:");
          console.log("   From:", selectedYear);
          console.log("   To:", year);
          console.log("   Type:", typeof year);
          console.log("   Is empty string?", year === "");
          console.log("   Is null?", year === null);
          console.log("━".repeat(60));
          setSelectedYear(year);
        }}
        onPeriodToggle={handlePeriodToggle}
        onSelectAll={handleSelectAll}
        onDateChange={(date) => setSelectedDate(date)}
        onClearFilters={handleClearFilters}
        onDefaultPeriodReady={(period) => {
          console.log("✅ Default period ready from filters:", period);
        }}
      />

      {/* KPI Cards */}
      <SalesKPICards
        kpiData={kpiData}
        allData={allData}
        filteredData={filteredData}
        config={config}
        selectedPeriods={selectedPeriods}
      />

      {/* Charts */}
      <SalesCharts
        pieChartData={pieChartData}
        lineChartData={lineChartData}
        waterfallData={waterfallData}
      />

      {/* Ranking */}
      <SalesRanking rankingTableData={rankingTableData} />
    </div>
  );
}