/**
 * Dashboard Auto-Generation Utils
 * Analyzes config sheet and generates appropriate visualizations
 */

export interface ConfigField {
  fieldName: string;
  label: string;
  type: "date" | "number" | "text" | "period" | "other";
  order: number;
}

export interface DashboardConfig {
  dateFields: ConfigField[];
  numberFields: ConfigField[];
  textFields: ConfigField[];
  periodField: ConfigField | null;
}

export interface ProcessedData {
  [key: string]: any;
}

/**
 * Parse config sheet rows into structured format
 * Assumes columns: 0=field_name, 1=label, 2=type, 3=order
 */
export function parseConfigSheet(rows: any[][]): ConfigField[] {
  if (rows.length === 0) return [];

  return rows
    .slice(1) // skip header
    .map((row) => ({
      fieldName: row[0]?.toString().trim() || "",
      label: row[1]?.toString().trim() || "",
      type: (row[2]?.toString().toLowerCase().trim() || "other") as
        | "date"
        | "number"
        | "text"
        | "period"
        | "other",
      order: parseInt(row[3]?.toString() || "999") || 999,
    }))
    .filter((f) => f.fieldName) // remove empty rows
    .sort((a, b) => a.order - b.order);
}

/**
 * Organize config fields by type for visualization planning
 */
export function organizeDashboardConfig(
  fields: ConfigField[]
): DashboardConfig {
  return {
    dateFields: fields.filter((f) => f.type === "date"),
    numberFields: fields.filter((f) => f.type === "number"),
    textFields: fields.filter((f) => f.type === "text"),
    periodField: fields.find((f) => f.type === "period") || null,
  };
}

/**
 * Determine which visualizations can be created
 */
export function detectVisualizations(config: DashboardConfig) {
  return {
    hasLineChart: config.dateFields.length > 0 && config.numberFields.length > 0,
    hasRankingTable:
      config.textFields.length > 0 && config.numberFields.length > 0,
    hasKPICards: config.numberFields.length > 0,
    hasPeriodFilter: config.periodField !== null,
  };
}

/**
 * Parse data sheet rows into array of objects
 */
export function parseDataSheet(
  rows: any[][],
  fieldNames: string[]
): ProcessedData[] {
  if (rows.length === 0) return [];

  const headerRow = rows[0];
  const columnIndices: { [key: string]: number } = {};

  // Map field names to column indices
  fieldNames.forEach((fieldName) => {
    const idx = headerRow.findIndex(
      (h) => h?.toString().toLowerCase() === fieldName.toLowerCase()
    );
    if (idx !== -1) {
      columnIndices[fieldName] = idx;
    }
  });

  // Convert rows to objects
  return rows
    .slice(1) // skip header
    .map((row) => {
      const obj: ProcessedData = {};
      fieldNames.forEach((fieldName) => {
        const colIdx = columnIndices[fieldName];
        if (colIdx !== undefined) {
          obj[fieldName] = row[colIdx];
        }
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v)); // filter empty rows
}

/**
 * Group data by date for line chart
 */
export function groupByDate(
  data: ProcessedData[],
  dateField: string,
  numberFields: string[]
): any[] {
  const grouped: { [key: string]: any } = {};

  data.forEach((row) => {
    const dateStr = row[dateField]?.toString().trim();
    if (!dateStr) return;

    if (!grouped[dateStr]) {
      grouped[dateStr] = { date: dateStr };
      numberFields.forEach((nf) => {
        grouped[dateStr][nf] = 0;
      });
    }

    numberFields.forEach((nf) => {
      const value = parseFloat(row[nf]?.toString() || "0");
      if (!isNaN(value)) {
        grouped[dateStr][nf] += value;
      }
    });
  });

  return Object.values(grouped).sort((a, b) => {
    // Try to sort by date
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
    return a.date.localeCompare(b.date);
  });
}

/**
 * Create ranking table data
 */
export function createRankingTable(
  data: ProcessedData[],
  textField: string,
  numberFields: string[],
  topN: number = 10
): any[] {
  const grouped: { [key: string]: any } = {};

  data.forEach((row) => {
    const textValue = row[textField]?.toString().trim();
    if (!textValue) return;

    if (!grouped[textValue]) {
      grouped[textValue] = { [textField]: textValue };
      numberFields.forEach((nf) => {
        grouped[textValue][nf] = 0;
      });
    }

    numberFields.forEach((nf) => {
      const value = parseFloat(row[nf]?.toString() || "0");
      if (!isNaN(value)) {
        grouped[textValue][nf] += value;
      }
    });
  });

  return Object.values(grouped)
    .sort((a, b) => {
      // Sort by first number field (usually total_sales)
      const keyField = numberFields[0];
      return (b[keyField] || 0) - (a[keyField] || 0);
    })
    .slice(0, topN);
}

/**
 * Calculate KPI values
 */
export function calculateKPIs(
  data: ProcessedData[],
  numberField: string
): { sum: number; avg: number; count: number; max: number; min: number } {
  const values = data
    .map((row) => parseFloat(row[numberField]?.toString() || "0"))
    .filter((v) => !isNaN(v) && v !== 0);

  if (values.length === 0) {
    return { sum: 0, avg: 0, count: 0, max: 0, min: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);

  return {
    sum,
    avg: sum / values.length,
    count: values.length,
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

/**
 * Get unique values for period filter
 */
export function getUniqueValues(
  data: ProcessedData[],
  fieldName: string
): string[] {
  const uniqueSet = new Set(
    data
      .map((row) => row[fieldName]?.toString().trim())
      .filter((v) => v && v !== "")
  );

  return Array.from(uniqueSet).sort();
}

/**
 * Filter data by period
 */
export function filterByPeriod(
  data: ProcessedData[],
  periodField: string,
  periodValue: string
): ProcessedData[] {
  if (!periodValue) return data;

  return data.filter(
    (row) => row[periodField]?.toString().trim() === periodValue
  );
}