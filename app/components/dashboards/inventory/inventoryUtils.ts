/**
 * Inventory Dashboard Utilities
 * Location: app/components/dashboards/inventory/inventoryUtils.ts
 * ✅ For Inventory/Stock management dashboard
 */

export interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

export interface KPIData {
  totalValue: number;      // มูลค่าสต๊อครวม
  productCount: number;    // จำนวนประเภทสินค้า (unique products)
}

export interface LowStockItem {
  product: string;
  remain: string;        // คงเหลือ (text จาก sheet)
  stockprice: number;    // มูลค่าสต๊อค
  status: string;
}

export interface ProductTableRow {
  product: string;
  remain: string;        // คงเหลือ (text จาก sheet)
  stockprice: number;    // มูลค่าสต๊อค
  status: string;
}

// ============================================================
// PARSE UTILITIES
// ============================================================

/**
 * Parse numeric value from string or number
 * ✅ Handles: "฿1,000", "$1,000.50", "1000", 1000
 */
function parseNumericValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    // ✅ Remove: commas, currency symbols, spaces
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
 * Generate KPI data for Inventory Dashboard
 * ✅ Returns: Total stock value (sum of stockprice) + Unique product count
 * ✅ stockprice is already calculated value, no need to multiply
 */
export interface KPIData {
  totalValue: number;           // มูลค่าสต๊อครวม
  productCount: number;         // จำนวนประเภทสินค้า (unique products)
  lowStockCount: number;        // ✅ สต๊อกต่ำ
  criticalStockCount: number;   // ✅ ใกล้หมด
  normalStockCount: number;     // ✅ ปกติ
}

/**
 * Generate KPI data for Inventory Dashboard
 * ✅ Returns: Total stock value + Product counts by status
 */
export function generateInventoryKPI(
  rows: any[],
  configFields: ConfigField[]
): KPIData {

  // Find required fields with fallbacks
  let productField = configFields.find((f) => f.fieldName === "product");
  if (!productField) {
    productField = configFields.find(
      (f) => 
        f.fieldName === "Product" ||
        f.label?.toLowerCase().includes("สินค้า") ||
        f.label?.toLowerCase().includes("product") ||
        (f.type === "text" && f.order === 1)
    );
  }
  
  let stockPriceField = configFields.find((f) => f.fieldName === "stockprice");
  if (!stockPriceField) {
    stockPriceField = configFields.find(
      (f) => 
        f.fieldName === "value" ||
        f.fieldName === "totalValue" ||
        f.label?.toLowerCase().includes("มูลค่า") ||
        f.label?.toLowerCase().includes("value")
    );
  }

  // ✅ Find Status Field
  let statusField = configFields.find((f) => f.fieldName === "status");
  if (!statusField) {
    statusField = configFields.find(
      (f) => 
        f.fieldName === "Status" ||
        f.label?.toLowerCase().includes("สถานะ")
    );
  }

  if (!productField || !stockPriceField) {
    return { 
      totalValue: 0, 
      productCount: 0, 
      lowStockCount: 0, 
      criticalStockCount: 0, 
      normalStockCount: 0 
    };
  }

  if (statusField) {
  }

  let totalValue = 0;
  const uniqueProducts = new Set<string>();
  let lowStockCount = 0;
  let criticalStockCount = 0;
  let normalStockCount = 0;
  let processedRows = 0;
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const product = String(row[productField.fieldName] || "").trim();
    const stockPrice = parseNumericValue(row[stockPriceField.fieldName]);
    const status = statusField ? String(row[statusField.fieldName] || "").trim() : "";

    if (!product) {
      skippedRows++;
      return;
    }

    const value = stockPrice || 0;

    uniqueProducts.add(product);
    totalValue += value;

    // ✅ Count by status
    const statusLower = status.toLowerCase();
    if (statusLower.includes("ใกล้หมด")) {
      criticalStockCount++;
    } else if (statusLower.includes("สต๊อกต่ำ")) {
      lowStockCount++;
    } else if (statusLower.includes("ปกติ") || statusLower.includes("คงเหลือ")) {
      normalStockCount++;
    } else {
      normalStockCount++; // Default to normal if unknown
    }

    processedRows++;

    // Debug first 3 processed rows
    if (processedRows <= 3) {
    }
  });

  const result = {
    totalValue: Number(totalValue.toFixed(2)),
    productCount: uniqueProducts.size,
    lowStockCount,
    criticalStockCount,
    normalStockCount,
  };


  return result;
}

// ============================================================
// LOW STOCK ALERTS
// ============================================================

/**
 * Get low stock items
 * ✅ Filters by status: "สต๊อกต่ำ" or "ใกล้หมด"
 * ✅ Shows: product, remain (text), stockprice, status
 */
export function getLowStockItems(
  rows: any[],
  configFields: ConfigField[]
): LowStockItem[] {

  // Find fields with fallbacks
  let productField = configFields.find((f) => f.fieldName === "product");
  if (!productField) {
    productField = configFields.find(
      (f) => 
        f.fieldName === "Product" ||
        f.label?.toLowerCase().includes("สินค้า") ||
        (f.type === "text" && f.order === 1)
    );
  }
  
  let remainField = configFields.find((f) => f.fieldName === "remain");
  if (!remainField) {
    remainField = configFields.find(
      (f) => 
        f.fieldName === "remaining" ||
        f.label?.toLowerCase().includes("คงเหลือ")
    );
  }
  
  let stockPriceField = configFields.find((f) => f.fieldName === "stockprice");
  if (!stockPriceField) {
    stockPriceField = configFields.find(
      (f) => 
        f.fieldName === "value" ||
        f.label?.toLowerCase().includes("มูลค่า")
    );
  }
  
  let statusField = configFields.find((f) => f.fieldName === "status");
  if (!statusField) {
    statusField = configFields.find(
      (f) => 
        f.fieldName === "Status" ||
        f.label?.toLowerCase().includes("สถานะ")
    );
  }

  if (!productField || !remainField || !stockPriceField || !statusField) {
    return [];
  }


  const lowStockStatuses = ["สต๊อกต่ำ", "ใกล้หมด"];

  const results = rows
    .filter((row) => {
      const status = String(row[statusField.fieldName] || "").trim();
      return lowStockStatuses.includes(status);
    })
    .map((row) => {
      const product = String(row[productField.fieldName] || "").trim();
      const remain = String(row[remainField.fieldName] || "").trim();
      const stockprice = parseNumericValue(row[stockPriceField.fieldName]) || 0;
      const status = String(row[statusField.fieldName] || "").trim();

      return {
        product,
        remain,
        stockprice,
        status,
      };
    })
    .filter((item) => item.product); // Remove empty products

  return results;
}

// ============================================================
// PRODUCT TABLE DATA
// ============================================================

/**
 * Generate product table data
 * ✅ All products with: product, remain (text), stockprice, status
 */
export function generateProductTableData(
  rows: any[],
  configFields: ConfigField[]
): ProductTableRow[] {

  // Find fields with fallbacks
  let productField = configFields.find((f) => f.fieldName === "product");
  if (!productField) {
    productField = configFields.find(
      (f) => 
        f.fieldName === "Product" ||
        f.label?.toLowerCase().includes("สินค้า") ||
        (f.type === "text" && f.order === 1)
    );
  }
  
  let remainField = configFields.find((f) => f.fieldName === "remain");
  if (!remainField) {
    remainField = configFields.find(
      (f) => 
        f.fieldName === "remaining" ||
        f.label?.toLowerCase().includes("คงเหลือ")
    );
  }
  
  let stockPriceField = configFields.find((f) => f.fieldName === "stockprice");
  if (!stockPriceField) {
    stockPriceField = configFields.find(
      (f) => 
        f.fieldName === "value" ||
        f.label?.toLowerCase().includes("มูลค่า")
    );
  }
  
  let statusField = configFields.find((f) => f.fieldName === "status");
  if (!statusField) {
    statusField = configFields.find(
      (f) => 
        f.fieldName === "Status" ||
        f.label?.toLowerCase().includes("สถานะ")
    );
  }

  if (!productField || !remainField || !stockPriceField || !statusField) {
    return [];
  }

  const results = rows
    .map((row) => {
      const product = String(row[productField.fieldName] || "").trim();
      const remain = String(row[remainField.fieldName] || "").trim();
      const stockprice = parseNumericValue(row[stockPriceField.fieldName]) || 0;
      const status = String(row[statusField.fieldName] || "").trim();

      return {
        product,
        remain,
        stockprice,
        status,
      };
    })
    .filter((item) => item.product); // Remove empty products

  return results;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes("ใกล้หมด")) return "#ef4444"; // 🔴 Red
  if (statusLower.includes("สต๊อกต่ำ")) return "#f59e0b"; // 🟠 Orange
  if (statusLower.includes("ปกติ") || statusLower.includes("คงเหลือ")) return "#10b981"; // 🟢 Green
  
  return "#64748b"; // Gray (default)
}

/**
 * Get status icon
 */
export function getStatusIcon(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes("ใกล้หมด")) return "";
  if (statusLower.includes("สต๊อกต่ำ")) return "";
  if (statusLower.includes("ปกติ") || statusLower.includes("คงเหลือ")) return "";
  
  return "📦";
}

/**
 * Format currency (Number only, no ฿ symbol)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format number
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}