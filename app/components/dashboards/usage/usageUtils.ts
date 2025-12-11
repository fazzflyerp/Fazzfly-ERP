/**
 * Usage Dashboard Utilities
 * Location: app/components/dashboards/usage/usageUtils.ts
 * ✅ Customized for Usage module with fields: date, product, quantity, cust_name, cost, staff
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  const parts = val.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const nums = parts.map((p) => parseInt(p, 10));
    const [first, second, third] = nums;

    let year: number, month: number, day: number;

    if (third >= 1900 && third <= 2100) {
      year = third;
      
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        day = first;
        month = second;
      }
    } else if (first >= 1900 && first <= 2100) {
      year = first;
      month = second;
      day = third;
    } else if (third < 100) {
      year = third > 50 ? 1900 + third : 2000 + third;
      
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        day = first;
        month = second;
      }
    } else {
      return null;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
      return null;
    }

    const m = String(month).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

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
 * Get available dates from data
 */
export function getAvailableDatesFromData(
  data: any[],
  periodFieldName: string,
  dateFieldName: string,
  selectedPeriod: string
): string[] {
  if (!selectedPeriod || !periodFieldName || !dateFieldName) return [];

  console.log(`🔍 Getting available dates for period: ${selectedPeriod}`);

  const filteredRows = data.filter((row) => {
    const rowPeriod = String(row[periodFieldName] || "").trim();
    return rowPeriod === String(selectedPeriod).trim();
  });

  console.log(`   Found ${filteredRows.length} rows for this period`);

  const rawDates = filteredRows
    .map((r) => {
      const val = r[dateFieldName];
      return String(val || "").trim();
    })
    .filter((v) => v !== "");

  console.log(`   Found ${rawDates.length} dates (before normalization)`);

  const normalizedDates = rawDates
    .map((val) => normalizeDate(val))
    .filter((d): d is string => !!d);

  console.log(`   Normalized to ${normalizedDates.length} dates`);

  const uniqueSorted = Array.from(new Set(normalizedDates)).sort();

  return uniqueSorted;
}

// ============================================================
// KPI GENERATION
// ============================================================

/**
 * Parse numeric value from string or number
 * ✅ EXPORTED for use in other functions
 */
export function parseNumericValue(raw: any): number | null {
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
 * ✅ With detailed logging for debugging
 */
export function generateKPI(
  rows: any[],
  configFields: ConfigField[]
): { [key: string]: KPIData } {
  console.log("━".repeat(60));
  console.log("📊 [generateKPI] START");
  console.log(`   Total rows: ${rows.length}`);
  console.log(`   Config fields: ${configFields.length}`);
  
  const newKpiData: { [key: string]: KPIData } = {};
  const numberFields = configFields.filter((f) => f.type === "number");
  
  console.log(`   Number fields found: ${numberFields.map(f => f.fieldName).join(", ")}`);

  numberFields.forEach((field) => {
    console.log(`\n   📈 Processing field: ${field.fieldName}`);
    
    const values = rows
      .map((r, idx) => {
        const raw = r[field.fieldName];
        const parsed = parseNumericValue(raw);
        
        if (idx < 3) {  // Log first 3 rows
          console.log(`      Row ${idx}: raw="${raw}" → parsed=${parsed}`);
        }
        
        return parsed;
      })
      .filter((v): v is number => typeof v === "number" && !isNaN(v));

    console.log(`      Valid values: ${values.length}/${rows.length}`);

    if (values.length === 0) {
      console.log(`      ⚠️ NO VALUES FOUND!`);
      newKpiData[field.fieldName] = { sum: 0, avg: 0, max: 0, count: 0 };
    } else {
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const count = values.length;

      console.log(`      ✅ sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, max=${max.toFixed(2)}, count=${count}`);

      newKpiData[field.fieldName] = {
        sum: Number(sum.toFixed(2)),
        avg: Number(avg.toFixed(2)),
        max: Number(max.toFixed(2)),
        count,
      };
    }
  });

  console.log("━".repeat(60));
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
 * Generate line chart data (Daily Cost Trend Only)
 * ✅ Show: cost over time (NO quantity)
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

  const grouped: Record<string, any> = {};

  rows.forEach((row) => {
    const rawDate = String(row[dateField.fieldName] || "").trim();
    if (!rawDate) return;

    const normalized = normalizeDate(rawDate);
    if (!normalized) return;

    const dateKey = normalized;

    if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey };

    const cost = parseNumericValue(row.cost) || 0;

    grouped[dateKey].cost = (grouped[dateKey].cost || 0) + cost;
  });

  const sorted = Object.values(grouped).sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  console.log(`✅ Line chart generated (${sorted.length} daily records, cost only)`);
  return sorted;
}
/**
 * Generate pie chart data (Cost by Product)
 * ✅ Show: ต้นทุนต่อ Product
 * 
 * Uses field names: product, cost
 */
export function generatePieChartData(rows: any[]): any[] {
  const grouped: Record<string, number> = {};

  rows.forEach((row) => {
    const product = String(row.product || "").trim();
    if (!product) return;

    const costValue = parseNumericValue(row.cost) || 0;
    grouped[product] = (grouped[product] || 0) + costValue;
  });

  const result = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  console.log(`✅ Pie chart generated: ${result.length} products`);
  return result;
}

/**
 * Generate ranking table: Top 10 สินค้าที่มีต้นทุนรวมสูงที่สุด
 */
export function generateRankingTableData(rows: any[]): any[] {
  const grouped: {
    [product: string]: {
      count: number;
      total_quantity: number;
      total_cost: number;
    };
  } = {};

  rows.forEach((row) => {
    const product = String(row["product"] || "").trim();
    if (!product) return;

    const quantityValue = parseNumericValue(row["quantity"]) || 0;
    const costValue = parseNumericValue(row["cost"]) || 0;

    if (!grouped[product]) {
      grouped[product] = {
        count: 0,
        total_quantity: 0,
        total_cost: 0,
      };
    }

    grouped[product].count += 1;
    grouped[product].total_quantity += quantityValue;
    grouped[product].total_cost += costValue;
  });

  return Object.entries(grouped)
    .map(([product, data]) => ({
      product,
      count: data.count,
      total_quantity: data.total_quantity,
      total_cost: data.total_cost,
    }))
    .sort((a, b) => b.total_cost - a.total_cost) // ✔ sort by cost มาก → น้อย
    .slice(0, 10);
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
      f.fieldName === "Month"
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
 * Generate transaction details table data
 * ✅ Use configFields to map field names correctly
 */
/**
 * Generate transaction details table data
 * ✅ Use configFields to find correct field names
 * Maps: date, product, quantity, cust_name, cost, staff
 */
export function generateTransactionTableData(
  rows: any[],
  configFields?: ConfigField[]
): any[] {
  // Find field names from config if provided
  const dateFieldName = configFields?.find((f) => f.type === "date")?.fieldName || "date";
  const productFieldName = configFields?.find((f) => f.fieldName === "product")?.fieldName || "product";
  const quantityFieldName = configFields?.find((f) => f.fieldName === "quantity")?.fieldName || "quantity";
  const custNameFieldName = configFields?.find((f) => f.fieldName === "cust_name")?.fieldName || "cust_name";
  const costFieldName = configFields?.find((f) => f.fieldName === "cost")?.fieldName || "cost";
  const staffFieldName = configFields?.find((f) => f.fieldName === "staff")?.fieldName || "staff";

  return rows
    .map((row) => ({
      date: row[dateFieldName] || "-",
      product: String(row[productFieldName] || "-").trim(),
      quantity: parseNumericValue(row[quantityFieldName]) || 0,
      cust_name: String(row[custNameFieldName] || "-").trim(),
      cost: parseNumericValue(row[costFieldName]) || 0,
      staff: String(row[staffFieldName] || "-").trim(),
    }))
    .filter((row) => row.cust_name !== "-")
    .sort((a, b) => a.cust_name.localeCompare(b.cust_name, "th-TH"));
}