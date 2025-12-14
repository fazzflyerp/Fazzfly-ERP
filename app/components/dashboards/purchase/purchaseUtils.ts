/**
 * Purchase Dashboard Utilities
 * Location: app/components/dashboards/purchase/purchaseUtils.ts
 * ✅ Customized for Purchase module with fields: period, date, product, quantity, cost, suppliers, status
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
 * ✅ Normalize date to YYYY-MM-DD
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
 * ✅ Handles: numbers, "100", "100.50", "1,000", "฿9.45", "$100"
 */
export function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    return isNaN(raw) ? null : raw;
  }
  
  if (typeof raw === "string") {
    // Remove currency symbols: ฿, $, €, etc.
    let clean = raw
      .replace(/[฿$€£¥]/g, "")  // Remove currency symbols
      .replace(/,/g, "")         // Remove commas
      .trim();
    
    if (clean === "") return null;
    
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
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
        
        if (idx < 3) {
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
 * Generate line chart data (Daily Purchase Trend)
 * ✅ Show: cost over time
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

    // Purchase has: quantity, cost
    const quantity = parseNumericValue(row.quantity) || 0;
    const cost = parseNumericValue(row.cost) || 0;

    grouped[dateKey].quantity = (grouped[dateKey].quantity || 0) + quantity;
    grouped[dateKey].cost = (grouped[dateKey].cost || 0) + cost;
  });

  const sorted = Object.values(grouped).sort(
    (a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  console.log(`✅ Line chart generated (${sorted.length} daily records)`);
  return sorted;
}

/**
 * Generate pie chart data (Cost by Product)
 * ✅ Show: ต้นทุนต่อ Product
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
 * Generate ranking table data (Top 10 Suppliers by Total Cost)
 * ✅ Show: ผู้ขายที่จ่ายมากสุด
 */
export function generateRankingTableData(rows: any[]): any[] {
  console.log("━".repeat(60));
  console.log("📊 [generateRankingTableData] START");
  console.log(`   Total rows: ${rows.length}`);
  
  // ✅ DEBUG: Show first row structure
  if (rows.length > 0) {
    console.log("   First row structure:");
    const firstRow = rows[0];
    console.log(`     Keys: ${Object.keys(firstRow).join(", ")}`);
    console.log(`     Full row:`, firstRow);
    console.log(`     suppliers field: "${firstRow.suppliers}"`);
  }
  
  const grouped: {
    [key: string]: { count: number; total_cost: number };
  } = {};

  let suppliersFound = 0;
  let suppliersEmpty = 0;

  rows.forEach((row, idx) => {
    const supplier = String(row.suppliers || "").trim();
    
    // Log first 5 rows to see what's in suppliers field
    if (idx < 5) {
      console.log(`   Row ${idx}: suppliers="${supplier}" (raw: ${JSON.stringify(row.suppliers)})`);
    }
    
    if (!supplier) {
      suppliersEmpty++;
      return;
    }

    suppliersFound++;
    const costValue = parseNumericValue(row.cost) || 0;

    if (!grouped[supplier]) {
      grouped[supplier] = { count: 0, total_cost: 0 };
    }
    grouped[supplier].count += 1;
    grouped[supplier].total_cost += costValue;
  });

  console.log(`   ✅ Suppliers found: ${suppliersFound}, empty: ${suppliersEmpty}`);
  console.log(`   ✅ Unique suppliers: ${Object.keys(grouped).length}`);
  
  if (Object.keys(grouped).length > 0) {
    console.log(`   ✅ Top suppliers: ${Object.keys(grouped).slice(0, 5).join(", ")}`);
  }

  const tableData = Object.entries(grouped)
    .map(([name, data]) => ({
      supplier_name: name,
      count: data.count,
      total_cost: data.total_cost,
    }))
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 10);

  console.log(`✅ Ranking table generated: ${tableData.length} rows`);
  console.log("━".repeat(60));
  return tableData;
}

/**
 * Generate pending items (Status = "รอรับของ")
 * ✅ Show: สินค้าที่ยังไม่ถูกจัดส่ง
 */
export function generatePendingItems(rows: any[]): any[] {
  const pending = rows.filter((row) => {
    const status = String(row.status || "").trim();
    return status === "รอรับของ";
  });

  // Group by product
  const grouped: Record<string, {
    count: number; 
    suppliers: string[]; 
    dates: string[];
    deliverdates: string[];
    total_quantity: number;  // ✅ เพิ่ม total quantity
    unit: string;            // ✅ เพิ่ม unit
  }> = {};

  pending.forEach((row) => {
    const product = String(row.product || "").trim();
    if (!product) return;

    const supplier = String(row.suppliers || "").trim();
    const date = String(row.date || "").trim();
    const deliverdate = String(row.deliverdate || "").trim();
    const quantity = parseNumericValue(row.quantity) || 0;  // ✅ เพิ่ม
    const unit = String(row.unit || "").trim();             // ✅ เพิ่ม (order 5)

    if (!grouped[product]) {
      grouped[product] = { 
        count: 0, 
        suppliers: [], 
        dates: [],
        deliverdates: [],
        total_quantity: 0,  // ✅ เพิ่ม
        unit: unit || "-"   // ✅ เพิ่ม
      };
    }
    grouped[product].count += 1;
    grouped[product].total_quantity += quantity;  // ✅ เพิ่ม
    if (supplier && !grouped[product].suppliers.includes(supplier)) {
      grouped[product].suppliers.push(supplier);
    }
    if (date) {
      grouped[product].dates.push(date);
    }
    if (deliverdate) {
      grouped[product].deliverdates.push(deliverdate);
    }
  });

  const result = Object.entries(grouped)
    .map(([name, data]) => ({
      product_name: name,
      pending_count: data.count,
      total_quantity: data.total_quantity,        // ✅ เพิ่ม
      unit: data.unit,                            // ✅ เพิ่ม
      suppliers: data.suppliers.join(", "),
      earliest_date: data.dates.length > 0 ? data.dates.sort()[0] : "-",
      earliest_deliverdate: data.deliverdates.length > 0 ? data.deliverdates.sort()[0] : "-",
    }))
    .sort((a, b) => b.pending_count - a.pending_count);

  console.log(`✅ Pending items generated: ${result.length} products`);
  return result;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get unique periods from data
 * ✅ With fallback for missing period field
 */
export function getPeriodOptions(
  data: any[],
  configFields: ConfigField[]
): string[] {
  // ✅ Try finding by type first
  let periodField = configFields.find((f) => f.type === "period");
  
  console.log("🔍 Looking for period field...");
  console.log("   Type 'period':", periodField?.fieldName);
  
  // ✅ Fallback: use known field names
  if (!periodField) {
    console.warn("⚠️ Period field not found by type, trying fallbacks...");
    periodField = configFields.find((f) => 
      f.fieldName === "period" ||
      f.fieldName === "Period" ||
      f.fieldName === "Month" ||
      f.fieldName === "เดือน" ||
      f.order === 1  // Check if order 1 is period
    );
    
    if (periodField) {
      console.log(`   ✅ Found by fallback: ${periodField.fieldName}`);
    }
  }
  
  // ✅ If STILL no period field, return empty (don't error out)
  if (!periodField) {
    console.warn("⚠️ No period field found - period filter will be disabled");
    console.log("   Available fields:", configFields.map(f => `${f.fieldName}(type:${f.type})`).join(", "));
    return [];
  }

  console.log(`✅ Using period field: ${periodField.fieldName}`);
  
  const periods = Array.from(
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

  console.log(`   Found ${periods.length} unique periods: ${periods.join(", ")}`);
  return periods;
}