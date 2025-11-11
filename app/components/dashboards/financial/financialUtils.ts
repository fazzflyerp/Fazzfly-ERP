/**
 * Financial Dashboard Utilities
 * Location: app/components/dashboards/financial/financialUtils.ts
 * ✅ 6 KPIs: total_sales, cost, profit, expense, net_profit, percent_net_profit
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
// PARSE UTILITIES
// ============================================================

/**
 * Parse numeric value from string or number
 * ✅ Handles: "฿1,000", "$1,000.50", "1000", 1000, "30%"
 */
function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    // ✅ Remove: commas, currency symbols, %, spaces
    const clean = raw
      .replace(/[฿$€£¥₹,%\s]/g, "")
      .trim();
    
    if (clean === "") return null;
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// ============================================================
// KPI GENERATION
// ============================================================

/**
 * Generate KPI data from rows
 * ✅ Returns: { total_sales: {...}, cost: {...}, profit: {...}, etc. }
 */
export function generateKPI(
  rows: any[],
  configFields: ConfigField[]
): { [key: string]: KPIData } {
  console.log("━".repeat(60));
  console.log("📊 [generateKPI] START - Financial");
  console.log("   Rows:", rows.length);
  console.log("   Config fields:", configFields.length);
  console.log("━".repeat(60));

  const newKpiData: { [key: string]: KPIData } = {};
  
  // ✅ Get all number and percent fields
  const numericFields = configFields.filter(
    (f) => f.type === "number" || f.type === "percent"
  );

  console.log("🔢 Numeric fields found:", numericFields.length);
  numericFields.forEach((f, i) => {
    console.log(`   [${i}] ${f.fieldName} (type: ${f.type}, order: ${f.order})`);
  });

  numericFields.forEach((field) => {
    console.log(`\n📍 Processing field: ${field.fieldName}`);
    
    // Sample first 3 rows
    console.log("   Sample raw values:");
    rows.slice(0, 3).forEach((r, i) => {
      console.log(`      Row ${i}: ${field.fieldName} = "${r[field.fieldName]}" (type: ${typeof r[field.fieldName]})`);
    });

    const values = rows
      .map((r) => parseNumericValue(r[field.fieldName]))
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    console.log(`   Parsed values: ${values.length}/${rows.length} successful`);
    if (values.length > 0) {
      console.log(`   Sample parsed: [${values.slice(0, 5).join(", ")}...]`);
    }

    if (values.length === 0) {
      console.warn(`   ⚠️ No valid numbers found for ${field.fieldName}!`);
      newKpiData[field.fieldName] = { sum: 0, avg: 0, max: 0, count: 0 };
    } else {
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const count = values.length;

      console.log(`   ✅ Results: sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, max=${max}, count=${count}`);

      newKpiData[field.fieldName] = {
        sum: Number(sum.toFixed(2)),
        avg: Number(avg.toFixed(2)),
        max: Number(max.toFixed(2)),
        count,
      };
    }
  });

  console.log("━".repeat(60));
  console.log("✅ [generateKPI] DONE");
  console.log("   Generated KPIs:", Object.keys(newKpiData));
  console.log("━".repeat(60));

  return newKpiData;
}

/**
 * Calculate metric change from previous period
 */
export function getMetricChange(
  fieldName: string,
  currentPeriod: string,
  allData: any[],
  configFields: ConfigField[]
): { change: number | null; icon: string } {
  if (!currentPeriod) {
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

  const currentIndex = allUniquePeriods.indexOf(currentPeriod);
  if (currentIndex <= 0) {
    return { change: null, icon: "" };
  }

  const previousPeriod = allUniquePeriods[currentIndex - 1];

  const currentData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === currentPeriod
  );
  const previousData = allData.filter(
    (row) => String(row[periodField.fieldName]).trim() === previousPeriod
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
 * Generate Stacked Bar Chart Data
 * ✅ Shows: Revenue, Cost, Expense per period
 */
export function generateStackedBarData(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  const periodField = configFields.find((f) => f.type === "period");
  if (!periodField) {
    console.warn("⚠️ No period field found");
    return [];
  }

  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const period = String(row[periodField.fieldName] || "").trim();
    if (!period) return;

    if (!grouped[period]) {
      grouped[period] = {
        period,
        total_sales: 0,
        cost: 0,
        expense: 0,
      };
    }

    grouped[period].total_sales += parseNumericValue(row["total_sales"]) || 0;
    grouped[period].cost += parseNumericValue(row["cost"]) || 0;
    grouped[period].expense += parseNumericValue(row["expense"]) || 0;
  });

  const result = Object.values(grouped);
  console.log(`✅ Stacked bar data generated: ${result.length} periods`);
  return result;
}

/**
 * Generate Area Chart Data
 * ✅ Shows: Profit vs Net Profit trend
 */
export function generateAreaChartData(
  rows: any[],
  configFields: ConfigField[]
): any[] {
  const periodField = configFields.find((f) => f.type === "period");
  if (!periodField) {
    console.warn("⚠️ No period field found");
    return [];
  }

  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const period = String(row[periodField.fieldName] || "").trim();
    if (!period) return;

    if (!grouped[period]) {
      grouped[period] = {
        period,
        profit: 0,
        net_profit: 0,
      };
    }

    grouped[period].profit += parseNumericValue(row["profit"]) || 0;
    grouped[period].net_profit += parseNumericValue(row["net_profit"]) || 0;
  });

  const result = Object.values(grouped);
  console.log(`✅ Area chart data generated: ${result.length} periods`);
  return result;
}

/**
 * Generate Gauge Chart Data
 * ✅ Shows: Average net profit margin %
 */
export function generateGaugeData(
  rows: any[],
  configFields: ConfigField[]
): number {
  const values = rows
    .map((r) => parseNumericValue(r["percent_net_profit"]))
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  if (values.length === 0) {
    console.warn("⚠️ No valid percent_net_profit values");
    return 0;
  }

  const avg = values.reduce((acc, curr) => acc + curr, 0) / values.length;
  console.log(`✅ Gauge data: ${avg.toFixed(2)}%`);
  return Number(avg.toFixed(2));
}

/**
 * Generate Financial Summary Table
 * ✅ Shows: Period, Revenue, Net Profit, % Net Profit
 */
export function generateSummaryTableData(rows: any[]): any[] {
  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const period = String(row["period"] || "").trim();
    if (!period) return;

    if (!grouped[period]) {
      grouped[period] = {
        period,
        total_sales: 0,
        net_profit: 0,
        percent_net_profit: 0,
        count: 0,
      };
    }

    grouped[period].total_sales += parseNumericValue(row["total_sales"]) || 0;
    grouped[period].net_profit += parseNumericValue(row["net_profit"]) || 0;
    grouped[period].percent_net_profit += parseNumericValue(row["percent_net_profit"]) || 0;
    grouped[period].count += 1;
  });

  const result = Object.entries(grouped)
    .map(([period, data]) => ({
      period,
      total_sales: data.total_sales,
      net_profit: data.net_profit,
      percent_net_profit: data.count > 0 
        ? Number((data.percent_net_profit / data.count).toFixed(2))
        : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  console.log(`✅ Summary table generated: ${result.length} rows`);
  return result;
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
  let periodField = configFields.find((f) => f.type === "period");
  
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

/**
 * Get profit margin color based on percentage
 */
export function getProfitMarginColor(percent: number): string {
  if (percent >= 30) return "#10b981"; // 🟢 Green - ดีมาก
  if (percent >= 20) return "#eab308"; // 🟡 Yellow - ดี
  if (percent >= 10) return "#f59e0b"; // 🟠 Orange - พอใช้
  return "#ef4444"; // 🔴 Red - ต่ำ
}

/**
 * Get profit margin label
 */
export function getProfitMarginLabel(percent: number): string {
  if (percent >= 30) return "ดีมาก";
  if (percent >= 20) return "ดี";
  if (percent >= 10) return "พอใช้";
  return "ควรปรับปรุง";
}