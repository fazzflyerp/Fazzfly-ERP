/**
 * Purchase Dashboard - Main Component (FIXED)
 * Location: app/components/dashboards/purchase/PurchaseDashboard.tsx
 * ✅ Customized for Purchase module with fields: period, date, product, quantity, cost, suppliers, status
 * ✅ FIXED: Transform array data to object format
 */

"use client";

import { useEffect, useState } from "react";
import PurchaseFilters from "./PurchaseFilters";
import PurchaseKPICards from "./PurchaseKPICards";
import PurchaseCharts from "./PurchaseCharts";
import PurchaseRanking from "./PurchaseRanking";
import {
  ConfigField,
  KPIData,
  generateKPI,
  generateLineChartData,
  generateRankingTableData,
  generatePieChartData,
  getPeriodOptions,
  normalizeDate,
} from "./purchaseUtils";

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
  accessToken?: string;
  archiveFolderId?: string;
  moduleName?: string;
}

/**
 * Transform array data to object format
 * ✅ Handle: API returns array vs config expects object
 * ✅ Handle: Case-insensitive field names (suppliers vs Supplier)
 */
function transformArrayDataToObject(data: any[], config: ConfigField[]): any[] {
  if (!data || data.length === 0) return [];

  // Check if first row is array or object
  const firstRow = data[0];
  if (!Array.isArray(firstRow)) {
    console.log("ℹ️ Data already in object format");

    // ✅ But check if field names need normalization
    if (firstRow && typeof firstRow === 'object') {
      console.log("🔧 Normalizing field names (case-insensitive)");

      // Create mapping: lowercase -> actual key in object
      const actualKeys = Object.keys(firstRow);
      const lowerToActual: Record<string, string> = {};
      actualKeys.forEach(key => {
        lowerToActual[key.toLowerCase()] = key;
      });

      console.log("   Actual keys in data:", actualKeys.join(", "));

      // Create normalized config mapping
      const normalized = config.map(field => {
        const lowerFieldName = field.fieldName.toLowerCase();
        const actualKey = lowerToActual[lowerFieldName];

        if (actualKey && actualKey !== field.fieldName) {
          console.log(`   ✅ Mapped: ${field.fieldName} → ${actualKey}`);
          return { ...field, fieldName: actualKey };
        }
        return field;
      });

      // Transform all rows with normalized field names
      return data.map((row) => {
        const obj: Record<string, any> = {};
        normalized.forEach((field) => {
          obj[field.fieldName] = row[field.fieldName];
        });
        return obj;
      });
    }

    return data;
  }

  console.log("━".repeat(60));
  console.log("🔄 [transformArrayDataToObject] START");
  console.log(`   Total rows: ${data.length}`);

  // Create fieldName -> index mapping based on order
  const fieldMap: Record<string, number> = {};
  config.forEach((field) => {
    fieldMap[field.fieldName] = field.order - 1; // order starts at 1, array index starts at 0
  });

  console.log("📋 Field mapping:");
  config.forEach((field) => {
    console.log(`   ${field.fieldName} (order ${field.order}) → index ${fieldMap[field.fieldName]}`);
  });

  // Transform each row
  const transformed = data.map((row, rowIdx) => {
    if (!Array.isArray(row)) return row;

    const obj: Record<string, any> = {};
    config.forEach((field) => {
      const index = fieldMap[field.fieldName];
      if (index !== undefined && index < row.length) {
        obj[field.fieldName] = row[index];
      }
    });

    if (rowIdx < 3) {
      console.log(`\n   Row ${rowIdx} (original): [${row.slice(0, 8).map(v => `"${v}"`).join(", ")}...]`);
      console.log(`   Row ${rowIdx} (transformed):`, obj);
    }

    return obj;
  });

  console.log(`\n✅ Transformed ${transformed.length} rows`);
  console.log("━".repeat(60));
  return transformed;
}

export default function PurchaseDashboard({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
  archiveFolderId,
  moduleName = "Purchase",
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
    console.log("🎯 Purchase Dashboard Props:");
    console.log(
      "   spreadsheetId:",
      spreadsheetId ? `${spreadsheetId.substring(0, 20)}...` : "❌ MISSING"
    );
    console.log("   configSheetName:", configSheetName || "❌ MISSING");
    console.log("   dataSheetName:", dataSheetName || "❌ MISSING");
    console.log("   moduleName:", moduleName);
    console.log("   archiveFolderId:", archiveFolderId || "(not provided)");

    if (!spreadsheetId || !configSheetName || !dataSheetName) {
      setError("❌ Missing required props: spreadsheetId, configSheetName, or dataSheetName");
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
    console.log("   selectedYear:", selectedYear || "Current");
    console.log("━".repeat(60));

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
    console.log("🔄 Filters changed - regenerating visualizations");
    console.log("   Periods:", selectedPeriods.length > 0 ? selectedPeriods : "all");
    console.log("   Date:", selectedDate || "all");

    if (allData.length > 0 && config.length > 0) {
      generateVisualizations(allData, selectedPeriods, config);
    }
  }, [selectedPeriods, selectedDate, allData, config]);

  // ============================================================
  // EFFECT: Log ranking data for debugging
  // ============================================================
  useEffect(() => {
    console.log("📊 Ranking data updated:");
    console.log(`   Count: ${rankingTableData.length}`);
    if (rankingTableData.length > 0) {
      console.log(`   Top supplier: ${rankingTableData[0].supplier_name}`);
      console.log(`   Data:`, rankingTableData);
    }
  }, [rankingTableData]);

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

      if (folderId.includes("drive.google.com") || folderId.includes("https://")) {
        const match = folderId.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          folderId = match[1];
        } else {
          setLoadingYears(false);
          return;
        }
      }

      const params = new URLSearchParams({
        archiveFolderId: folderId,
        ...(moduleName && { moduleName }),
      });

      const res = await fetch(`/api/dashboard/archive/years?${params}`);

      if (!res.ok) {
        console.log(`ℹ️ Could not fetch years (HTTP ${res.status})`);
        setLoadingYears(false);
        return;
      }

      const years = await res.json();
      console.log("✅ Years fetched:", years.map((y: any) => y.year).join(", "));
      setAvailableYears(years);
    } catch (err: any) {
      console.log("ℹ️ Year fetch skipped:", err.message);
    } finally {
      setLoadingYears(false);
    }
  };

  // ============================================================
  // API: Fetch Dashboard Data
  // ============================================================
  const fetchDashboardData = async () => {
    if (!spreadsheetId || !configSheetName || !dataSheetName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const targetSpreadsheetId =
        selectedYear && availableYears.length > 0
          ? availableYears.find((y) => y.year === selectedYear)?.spreadsheetId
          : spreadsheetId;

      if (!targetSpreadsheetId) {
        setLoading(false);
        return;
      }

      console.log("📡 Fetching dashboard data...");
      const params = new URLSearchParams({
        spreadsheetId: targetSpreadsheetId,
        configSheetName,
        dataSheetName,
      });

      const response = await fetch(`/api/dashboard/data?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: DashboardData = await response.json();

      if (data.config) {
        setConfig(data.config);
        console.log(`📋 Config loaded: ${data.config.length} fields`);
      }

      if (data.data) {
        // ✅ Transform array data to object format if needed
        const transformedData = transformArrayDataToObject(data.data, data.config || []);

        setAllData(transformedData);
        generateVisualizations(transformedData, [], data.config || []);
      }

      console.log("✅ Dashboard data loaded");
    } catch (err: any) {
      console.error("❌ Error fetching dashboard data:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Generate Visualizations (CLIENT-SIDE ONLY)
  // ============================================================
  const generateVisualizations = (
    data: any[],
    periods: string[],
    configFields: ConfigField[]
  ) => {
    console.log("📊 Generating visualizations (CLIENT-SIDE ONLY)");
    console.log(`   Periods: ${periods.length > 0 ? periods.join(", ") : "(none/disabled)"}`);

    // Filter by periods (only if periods exist)
    let workingData = data;
    if (periods.length > 0 && configFields.length > 0) {
      const periodField = configFields.find((f) => f.type === "period");
      if (periodField) {
        workingData = data.filter((row) =>
          periods.includes(String(row[periodField.fieldName]).trim())
        );
      }
    }

    // Filter by date
    if (selectedDate && configFields.length > 0) {
      const dateField = configFields.find((f) => f.type === "date");
      if (dateField) {
        workingData = workingData.filter((row) => {
          const rawDate = String(row[dateField.fieldName] || "").trim();
          const norm = normalizeDate(rawDate);
          return norm === selectedDate;
        });
      }
    }

    console.log(`   Working data rows: ${workingData.length}`);

    setFilteredData(workingData);

    // Generate KPI
    const kpi = generateKPI(workingData, configFields);
    setKpiData(kpi);

    // Generate charts
    console.log("📊 Generating line chart...");
    const lineData = generateLineChartData(workingData, configFields);
    console.log(`   Line chart: ${lineData.length} records`);
    setLineChartData(lineData);

    console.log("📊 Generating pie chart...");
    const pieData = generatePieChartData(workingData);
    console.log(`   Pie chart: ${pieData.length} items`);
    setPieChartData(pieData);

    console.log("📊 Generating ranking table...");
    const rankingData = generateRankingTableData(workingData);
    console.log(`   Ranking data: ${rankingData.length} suppliers`);
    setRankingTableData(rankingData);
  };

  // ============================================================
  // Handlers
  // ============================================================
  const handleYearChange = (year: string | null) => {
    setSelectedYear(year);
  };

  const handlePeriodToggle = (period: string) => {
    setSelectedPeriods((prev) =>
      prev.includes(period) ? prev.filter((p) => p !== period) : [...prev, period]
    );
  };

  const handleSelectAll = (periodOptions: string[]) => {
    setSelectedPeriods((prev) =>
      prev.length === periodOptions.length ? [] : periodOptions
    );
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleClearFilters = () => {
    setSelectedYear(null);
    setSelectedPeriods([]);
    setSelectedDate("");
  };

  // ============================================================
  // Render
  // ============================================================
  if (error && !config.length) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-semibold">❌ Error</p>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  const periodOptions = getPeriodOptions(allData, config);

  if (!loading && config.length > 0 && periodOptions.length === 0 && allData.length > 0) {
    console.log("ℹ️ No period field found - showing dashboard without period filter");
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      {!loading && (
        <PurchaseFilters
          config={config}
          allData={allData}
          selectedYear={selectedYear}
          selectedPeriods={selectedPeriods}
          selectedDate={selectedDate}
          availableYears={availableYears}
          loadingYears={loadingYears}
          archiveFolderId={archiveFolderId}
          loading={loading}
          onYearChange={handleYearChange}
          onPeriodToggle={handlePeriodToggle}
          onSelectAll={handleSelectAll}
          onDateChange={handleDateChange}
          onClearFilters={handleClearFilters}
        />
      )}
      {/* KPI Cards */}
      {!loading && (
        <>
          <PurchaseKPICards
            kpiData={kpiData}
            allData={allData}
            filteredData={filteredData}
            config={config}
            selectedPeriods={selectedPeriods}
          />

          {/* Charts */}
          <PurchaseCharts
            pieChartData={pieChartData}
            lineChartData={lineChartData}
          />

          {/* Ranking */}
          <PurchaseRanking rankingTableData={rankingTableData} />
        </>
      )}

      {/* Loading State */}
      {loading && (
<div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">กำลังโหลดข้อมูล Purchase Dashboard...</p>
          </div>
        </div>
      )}
    </div>
  );
}