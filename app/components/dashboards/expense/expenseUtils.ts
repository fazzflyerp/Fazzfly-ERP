/**
 * Expense Dashboard Utilities
 * Location: app/components/dashboards/expense/expenseUtils.ts
 * ✅ Customized for Expense module with fields: period, date, expense, amount
 */

export interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

export interface KPIData {
  sum: number;
  avg: number;
  max: number;
  count: number;
}

// ============================================================
// DATE UTILITIES
// ============================================================

/**
 * ✅ FIXED: Normalize date to YYYY-MM-DD
 * Support: "1/9/2025", "2025-09-01", "09-01-2025"
 * Handle D/M/YYYY format (1/9/2025 = 1 Sept, not 9 Jan)
 */
export function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const val = String(dateStr).trim();

  // ✅ Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  // ✅ Parse M/D/YYYY or D/M/YYYY format
  const parts = val.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const nums = parts.map((p) => parseInt(p, 10));
    const [first, second, third] = nums;

    let year: number, month: number, day: number;

    // Determine format based on value ranges
    if (third >= 1900 && third <= 2100) {
      // Format: ?/?/YYYY (need to figure out first 2 parts)
      year = third;
      
      // ✅ KEY FIX: If first > 12, it MUST be day (can't be month)
      // If second > 12, it MUST be day (can't be month)
      if (first > 12) {
        // first is definitely day
        day = first;
        month = second;
      } else if (second > 12) {
        // second is definitely day
        month = first;
        day = second;
      } else {
        // Both <= 12, ambiguous: assume D/M/YYYY (Thai convention)
        day = first;
        month = second;
      }
    } else if (first >= 1900 && first <= 2100) {
      // Format: YYYY/M/D
      year = first;
      month = second;
      day = third;
    } else if (third < 100) {
      // Format: M/D/YY or D/M/YY
      year = third > 50 ? 1900 + third : 2000 + third;
      
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        // Both <= 12, ambiguous: assume D/M/YYYY (Thai convention)
        day = first;
        month = second;
      }
    } else {
      return null;
    }

    // Validate
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }

    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  // ✅ Try Date object as fallback
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
  } catch (e) {
    // fallback
  }

  return null;
}

/**
 * Filter data by date range
 */
export function filterByDateRange(
  data: any[],
  dateFieldName: string,
  startDate?: string,
  endDate?: string
): any[] {
  if (!startDate && !endDate) return data;

  const sNorm = startDate ? normalizeDate(startDate) : null;
  const eNorm = endDate ? normalizeDate(endDate) : null;

  if (!sNorm && !eNorm) return data;

  return data.filter((row) => {
    const rawVal = String(row[dateFieldName] || "").trim();
    if (!rawVal) return false;

    const vNorm = normalizeDate(rawVal);
    if (!vNorm) return false;

    if (sNorm && eNorm && sNorm === eNorm) {
      return vNorm === sNorm;
    }

    if (sNorm && eNorm) {
      return vNorm >= sNorm && vNorm <= eNorm;
    }

    if (sNorm && !eNorm) {
      return vNorm >= sNorm;
    }

    if (!sNorm && eNorm) {
      return vNorm <= eNorm;
    }

    return true;
  });
}

/**
 * Get available dates from data (เฉพาะ Period ที่เลือก)
 */
export function getAvailableDatesFromData(
  data: any[],
  periodFieldName: string,
  dateFieldName: string,
  selectedPeriod: string
): string[] {
  if (!selectedPeriod || !periodFieldName || !dateFieldName) return [];

  console.log(`🔍 Getting available dates for period: ${selectedPeriod}`);

  // Filter by period
  const filteredRows = data.filter((row) => {
    const rowPeriod = String(row[periodFieldName] || "").trim();
    return rowPeriod === String(selectedPeriod).trim();
  });

  console.log(`   Found ${filteredRows.length} rows for this period`);

  // Get raw dates
  const rawDates = filteredRows
    .map((r) => {
      const val = r[dateFieldName];
      return String(val || "").trim();
    })
    .filter((v) => v !== "");

  console.log(`   Found ${rawDates.length} dates (before normalization)`);

  // Normalize dates
  const normalizedDates = rawDates
    .map((val) => normalizeDate(val))
    .filter((d): d is string => !!d);

  console.log(`   Normalized to ${normalizedDates.length} dates`);

  // Remove duplicates and sort
  const uniqueSorted = Array.from(new Set(normalizedDates)).sort();

  return uniqueSorted;
}

// ============================================================
// KPI GENERATION
// ============================================================

/**
 * Parse numeric value from string or number
 */
function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const clean = raw.replace(/,/g, "").trim();
    return clean === "" ? null : parseFloat(clean);
  }
  return null;
}

/**
 * Generate KPI data from rows
 */
export function generateKPI(
  rows: any[],
  configFields: ConfigField[]
): { [key: string]: KPIData } {
  const newKpiData: { [key: string]: KPIData } = {};
  const numberFields = configFields.filter((f) => f.type === "number");

  numberFields.forEach((field) => {
    const values = rows
      .map((r) => parseNumericValue(r[field.fieldName]))
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (values.length === 0) {
      newKpiData[field.fieldName] = { sum: 0, avg: 0, max: 0, count: 0 };
    } else {
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const count = values.length;

      newKpiData[field.fieldName] = {
        sum: Number(sum.toFixed(2)),
        avg: Number(avg.toFixed(2)),
        max: Number(max.toFixed(2)),
        count,
      };
    }
  });

  return newKpiData;
}

/**
 * Calculate metric change from previous period
 */
export function getMetricChange(
  fieldName: string,
  currentMonth: string,
  allData: any[],
  configFields: ConfigField[]
): { change: number | null; icon: string } {
  if (!currentMonth) {
    return { change: null, icon: "" };
  }

  const periodField = configFields.find((f) => f.type === "period");
  if (!periodField) return { change: null, icon: "" };

  const allUniquePeriods = Array.from(
    new Set(
      allData
        .map((d) => String(d[periodField.fieldName]).trim())
        .filter((p) => p !== "")
    )
  ).sort();

  const currentIndex = allUniquePeriods.indexOf(currentMonth);
  if (currentIndex <= 0) {
    return { change: null, icon: "" };
  }

  const previousMonth = allUniquePeriods[currentIndex - 1];

  const currentData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === currentMonth
  );
  const previousData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === previousMonth
  );

  const calculateSum = (data: any[], field: string) => {
    return data
      .map((r) => parseNumericValue(r[field]))
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .reduce((acc, curr) => acc + curr, 0);
  };

  const currentSum = calculateSum(currentData, fieldName);
  const previousSum = calculateSum(previousData, fieldName);

  if (previousSum === 0) {
    return { change: null, icon: "" };
  }

  const changePercent = ((currentSum - previousSum) / previousSum) * 100;
  const icon =
    changePercent > 0 ? "📈" : changePercent < 0 ? "📉" : "➡️";

  return { change: changePercent, icon };
}

// ============================================================
// CHART DATA GENERATION
// ============================================================

/**
 * Generate line chart data (Daily Expense Trend)
 * ✅ แสดง: ค่าใช้จ่ายรายวัน
 */
export function generateLineChartData(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  const dateField = configFields.find((f) => f.type === "date");
  if (!dateField) {
    console.warn("⚠️ No date field found in config");
    return [];
  }

  // ✅ Expense only has "amount" field
  const TARGET_FIELDS = ["amount"];
  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const rawDate = String(row[dateField.fieldName] || "").trim();
    if (!rawDate) return;

    const normalized = normalizeDate(rawDate);
    if (!normalized) return;

    const dateKey = normalized;

    if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey };

    TARGET_FIELDS.forEach((f) => {
      const val = parseNumericValue(row[f]) || 0;
      grouped[dateKey][f] = (grouped[dateKey][f] || 0) + val;
    });
  });

  const sorted = Object.values(grouped).sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  console.log(`✅ Line chart generated (${sorted.length} daily records)`);
  return sorted;
}

/**
 * Generate pie chart data (Expense by Category)
 * ✅ แสดง: สัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่
 */
export function generatePieChartData(rows: any[]): any[] {
  const grouped: Record<string, number> = {};

  rows.forEach((row) => {
    // ✅ Use "expense" field (หมวดหมู่ค่าใช้จ่าย)
    const category = String(row["expense"] || "").trim();
    if (!category) return;

    const amount = parseNumericValue(row["amount"]) || 0;
    grouped[category] = (grouped[category] || 0) + amount;
  });

  const result = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  console.log(`✅ Pie chart generated: ${result.length} categories`);
  return result;
}

/**
 * Generate ranking table data (Top 10 Expense Categories)
 * ✅ แสดง: หมวดหมู่ค่าใช้จ่ายสูงสุด 10 อันดับ
 */
export function generateRankingTableData(rows: any[]): any[] {
  const grouped: {
    [key: string]: { count: number; total_amount: number };
  } = {};

  rows.forEach((row) => {
    // ✅ Use "expense" field
    const category = String(row["expense"] || "").trim();
    if (!category) return;

    const amountValue = parseNumericValue(row["amount"]) || 0;

    if (!grouped[category]) {
      grouped[category] = { count: 0, total_amount: 0 };
    }
    grouped[category].count += 1;
    grouped[category].total_amount += amountValue;
  });

  const tableData = Object.entries(grouped)
    .map(([name, data]) => ({
      expense_name: name,
      count: data.count,
      total_amount: data.total_amount,
    }))
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 10);

  console.log(`✅ Ranking table generated: ${tableData.length} rows`);
  return tableData;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get unique periods from data
 */
export function getPeriodOptions(
  data: any[],
  configFields: ConfigField[]
): string[] {
  // ✅ Try finding by type first
  let periodField = configFields.find((f) => f.type === "period");
  
  // ✅ Fallback: use known field name
  if (!periodField) {
    console.warn("⚠️ Period field not found by type, using fallback");
    periodField = configFields.find((f) => 
      f.fieldName === "period" ||
      f.fieldName === "Period" ||
      f.fieldName === "Month" ||
      f.fieldName === "เดือน"
    );
  }
  
  if (!periodField) {
    console.error("❌ Cannot find period field!");
    console.log("Available fields:", configFields.map(f => f.fieldName));
    return [];
  }

  return Array.from(
    new Set(
      data
        .map((d) => d[periodField.fieldName])
        .filter(
          (p) =>
            p !== null &&
            p !== undefined &&
            String(p).trim() !== ""
        )
        .map(String)
    )
  ).sort();
}