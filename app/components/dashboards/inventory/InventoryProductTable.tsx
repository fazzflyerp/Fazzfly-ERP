/**
 * Inventory Product Table Component
 * Location: app/components/dashboards/inventory/InventoryProductTable.tsx
 * ✅ Displays: All products in a table format
 */

"use client";

import React, { useState } from "react";
import { ProductTableRow, formatCurrency, formatNumber, getStatusColor, getStatusIcon } from "./inventoryUtils";

interface InventoryProductTableProps {
  products: ProductTableRow[];
}

export default function InventoryProductTable({
  products,
}: InventoryProductTableProps) {
  const [sortField, setSortField] = useState<keyof ProductTableRow>("product");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  if (products.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
        <p className="text-yellow-700 font-semibold">⚠️ ไม่พบข้อมูลสินค้า</p>
      </div>
    );
  }

  // Sorting logic
  const handleSort = (field: keyof ProductTableRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (sortDirection === "asc") {
      return aStr.localeCompare(bStr, "th");
    } else {
      return bStr.localeCompare(aStr, "th");
    }
  });

  // Calculate totals
  const totalStockPrice = products.reduce((sum, p) => sum + p.stockprice, 0);

  const SortIcon = ({ field }: { field: keyof ProductTableRow }) => {
    if (sortField !== field) {
      return <span className="text-slate-400">↕️</span>;
    }
    return (
      <span className="text-blue-600">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span className="text-2xl"></span>
          รายการสินค้าทั้งหมด
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          แสดงข้อมูลสินค้า {products.length} รายการ
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th
                onClick={() => handleSort("product")}
                className="px-4 lg:px-6 py-4 text-left text-sm font-bold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  สินค้า
                  <SortIcon field="product" />
                </div>
              </th>
              <th
                onClick={() => handleSort("remain")}
                className="px-4 lg:px-6 py-4 text-right text-sm font-bold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  คงเหลือ
                  <SortIcon field="remain" />
                </div>
              </th>
              <th
                onClick={() => handleSort("stockprice")}
                className="px-4 lg:px-6 py-4 text-right text-sm font-bold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-end gap-2">
                  มูลค่าสต๊อค
                  <SortIcon field="stockprice" />
                </div>
              </th>
              <th
                onClick={() => handleSort("status")}
                className="px-4 lg:px-6 py-4 text-center text-sm font-bold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-center gap-2">
                  สถานะ
                  <SortIcon field="status" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => {
              const statusColor = getStatusColor(product.status);
              const statusIcon = getStatusIcon(product.status);

              return (
                <tr
                  key={index}
                  className="hover:bg-slate-50 transition-colors"
                >
                  {/* Product Name */}
                  <td className="px-4 lg:px-6 py-4 text-sm font-semibold text-slate-800 border-b border-slate-100">
                    {product.product}
                  </td>

                  {/* Remain (text as-is) */}
                  <td className="px-4 lg:px-6 py-4 text-sm text-right font-medium text-slate-700 border-b border-slate-100">
                    {product.remain}
                  </td>

                  {/* Stock Price */}
                  <td className="px-4 lg:px-6 py-4 text-sm text-right font-bold text-slate-800 border-b border-slate-100">
                    {formatCurrency(product.stockprice)}
                  </td>

                  {/* Status */}
                  <td className="px-4 lg:px-6 py-4 text-center border-b border-slate-100">
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                      style={{
                        backgroundColor: `${statusColor}20`,
                        color: statusColor,
                      }}
                    >
                      <span>{statusIcon}</span>
                      {product.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer: Totals */}
          <tfoot className="bg-slate-50 font-bold">
            <tr>
              <td className="px-4 lg:px-6 py-4 text-sm text-slate-800 border-t-2 border-slate-300">
                รวมทั้งหมด
              </td>
              <td className="px-4 lg:px-6 py-4 text-sm text-right text-slate-800 border-t-2 border-slate-300">
                {products.length} รายการ
              </td>
              <td className="px-4 lg:px-6 py-4 text-sm text-right text-blue-600 border-t-2 border-slate-300">
                {formatCurrency(totalStockPrice)}
              </td>
              <td className="px-4 lg:px-6 py-4 text-sm text-center text-slate-600 border-t-2 border-slate-300">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}