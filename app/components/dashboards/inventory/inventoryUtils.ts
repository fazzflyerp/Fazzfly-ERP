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
export function generateInventoryKPI(
  rows: any[],
  configFields: ConfigField[]
): KPIData {
  console.log("═".repeat(60));
  console.log("📦 [generateInventoryKPI] START");
  console.log("   Rows:", rows.length);
  console.log("   Config fields:", configFields.length);
  console.log("═".repeat(60));

  // Debug: Show all config fields
  console.log("📋 Available config fields:");
  configFields.forEach((f, i) => {
    console.log(`   [${i}] fieldName: "${f.fieldName}", label: "${f.label}", type: "${f.type}", order: ${f.order}`);
  });

  // Debug: Show first row structure
  if (rows.length > 0) {
    console.log("\n📊 First row structure:");
    const firstRow = rows[0];
    console.log(`   Keys: ${Object.keys(firstRow).join(", ")}`);
    console.log(`   Full row:`, firstRow);
  }

  console.log("\n🔍 Searching for required fields...");

  // ✅ Find Product Field
  let productField = configFields.find((f) => f.fieldName === "product");
  if (!productField) {
    console.log("   ⚠️ 'product' not found, trying alternatives...");
    productField = configFields.find(
      (f) => 
        f.fieldName === "Product" ||
        f.label?.toLowerCase().includes("สินค้า") ||
        f.label?.toLowerCase().includes("product") ||
        (f.type === "text" && f.order === 1)
    );
  }
  console.log(`   Product field: ${productField ? `"${productField.fieldName}"` : "❌ NOT FOUND"}`);
  
  // ✅ Find Stock Price Field - This is the TOTAL VALUE per product
  let stockPriceField = configFields.find((f) => f.fieldName === "stockprice");
  if (!stockPriceField) {
    console.log("   ⚠️ 'stockprice' not found, trying alternatives...");
    stockPriceField = configFields.find(
      (f) => 
        f.fieldName === "value" ||
        f.fieldName === "totalValue" ||
        f.label?.toLowerCase().includes("มูลค่า") ||
        f.label?.toLowerCase().includes("value")
    );
  }
  console.log(`   Stock Price field: ${stockPriceField ? `"${stockPriceField.fieldName}"` : "❌ NOT FOUND"}`);

  if (!productField || !stockPriceField) {
    console.error("\n❌ Required fields not found!");
    console.error("   Missing:");
    if (!productField) console.error("   - Product field");
    if (!stockPriceField) console.error("   - Stock Price field");
    console.error("\n   Available field names:", configFields.map(f => f.fieldName).join(", "));
    console.error("   Please check Config sheet field names match expectations");
    console.log("═".repeat(60));
    return { totalValue: 0, productCount: 0 };
  }

  console.log("\n✅ All required fields found!");
  console.log(`   Using: product="${productField.fieldName}", stockprice="${stockPriceField.fieldName}"`);

  // Debug: Sample values from first 3 rows
  console.log("\n📊 Sample values (first 3 rows):");
  rows.slice(0, 3).forEach((row, idx) => {
    console.log(`   Row ${idx}:`);
    console.log(`     ${productField.fieldName}: "${row[productField.fieldName]}"`);
    console.log(`     ${stockPriceField.fieldName}: "${row[stockPriceField.fieldName]}"`);
  });

  let totalValue = 0;
  const uniqueProducts = new Set<string>();
  let processedRows = 0;
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const product = String(row[productField.fieldName] || "").trim();
    const stockPrice = parseNumericValue(row[stockPriceField.fieldName]);

    if (!product) {
      skippedRows++;
      return;
    }

    const value = stockPrice || 0;

    uniqueProducts.add(product);
    totalValue += value;
    processedRows++;

    // Debug first 3 processed rows
    if (processedRows <= 3) {
      console.log(`\n   Processing row ${index}: ${product}`);
      console.log(`     Stock Price: ${row[stockPriceField.fieldName]} → ${value}`);
    }
  });

  const result = {
    totalValue: Number(totalValue.toFixed(2)),
    productCount: uniqueProducts.size,
  };

  console.log("\n" + "═".repeat(60));
  console.log("✅ [generateInventoryKPI] COMPLETE");
  console.log(`   Processed: ${processedRows} rows`);
  console.log(`   Skipped: ${skippedRows} rows (empty product)`);
  console.log(`   Total Value: ฿${result.totalValue.toLocaleString("th-TH")}`);
  console.log(`   Unique Products: ${result.productCount}`);
  console.log("═".repeat(60));

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
  console.log("⚠️ [getLowStockItems] Checking low stock...");
  console.log(`   Total rows: ${rows.length}`);

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
    console.error("❌ Required fields not found for low stock check!");
    return [];
  }

  console.log(`   Using: status="${statusField.fieldName}"`);

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

  console.log(`   ✅ Found ${results.length} low stock items`);
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
  console.log("📋 [generateProductTableData] Generating table...");
  console.log(`   Total rows: ${rows.length}`);

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
    console.error("❌ Required fields not found for product table!");
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

  console.log(`   ✅ Generated ${results.length} table rows`);
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