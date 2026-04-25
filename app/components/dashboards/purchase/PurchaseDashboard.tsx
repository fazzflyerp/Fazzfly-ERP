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

    // ✅ But check if field names need normalization
    if (firstRow && typeof firstRow === 'object') {

      // Create mapping: lowercase -> actual key in object
      const actualKeys = Object.keys(firstRow);
      const lowerToActual: Record<string, string> = {};
      actualKeys.forEach(key => {
        lowerToActual[key.toLowerCase()] = key;
      });


      // Create normalized config mapping
      const normalized = config.map(field => {
        const lowerFieldName = field.fieldName.toLowerCase();
        const actualKey = lowerToActual[lowerFieldName];

        if (actualKey && actualKey !== field.fieldName) {
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


  // Create fieldName -> index mapping based on order
  const fieldMap: Record<string, number> = {};
  config.forEach((field) => {
    fieldMap[field.fieldName] = field.order - 1; // order starts at 1, array index starts at 0
  });

  config.forEach((field) => {
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
    }

    return obj;
  });

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

    if (!spreadsheetId || !configSheetName || !dataSheetName) {
      setError("❌ Missing required props: spreadsheetId, configSheetName, or dataSheetName");
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
  // EFFECT: Log ranking data for debugging
  // ============================================================
  useEffect(() => {
    if (rankingTableData.length > 0) {
    }
  }, [rankingTableData]);

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
        setLoadingYears(false);
        return;
      }

      const years = await res.json();
      setAvailableYears(years);
    } catch (err: any) {
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
      }

      if (data.data) {
        // ✅ Transform array data to object format if needed
        const transformedData = transformArrayDataToObject(data.data, data.config || []);

        setAllData(transformedData);
        generateVisualizations(transformedData, [], data.config || []);
      }

    } catch (err: any) {
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


    setFilteredData(workingData);

    // Generate KPI
    const kpi = generateKPI(workingData, configFields);
    setKpiData(kpi);

    // Generate charts
    const lineData = generateLineChartData(workingData, configFields);
    setLineChartData(lineData);

    const pieData = generatePieChartData(workingData);
    setPieChartData(pieData);

    const rankingData = generateRankingTableData(workingData);
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