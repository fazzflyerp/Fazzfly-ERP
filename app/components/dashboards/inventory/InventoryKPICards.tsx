/**
 * Inventory KPI Cards Component
 * Location: app/components/dashboards/inventory/InventoryKPICards.tsx
 * ✅ Displays: 2 KPI cards (Total Stock Value + Product Count)
 */

"use client";

import React from "react";
import { KPIData, formatCurrency, formatNumber } from "./inventoryUtils";

interface InventoryKPICardsProps {
  kpiData: KPIData;
}

export default function InventoryKPICards({
  kpiData,
}: InventoryKPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Card 1: Total Stock Value */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 border-2 border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-2xl shadow-lg">
            💰
          </div>
        </div>

        {/* Label */}
        <p className="text-sm font-medium text-slate-600 mb-2">มูลค่าสต๊อครวม</p>

        {/* Main Value */}
        <p className="text-4xl font-bold text-slate-800 mb-4">
          {formatCurrency(kpiData.totalValue)}
        </p>

        {/* Description */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            มูลค่ารวมของสินค้าทั้งหมดในสต๊อก
          </p>
        </div>
      </div>

      {/* Card 2: Product Count */}
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 border-2 border-purple-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white text-2xl shadow-lg">
            📦
          </div>
        </div>

        {/* Label */}
        <p className="text-sm font-medium text-slate-600 mb-2">จำนวนประเภทสินค้า</p>

        {/* Main Value */}
        <p className="text-4xl font-bold text-slate-800 mb-4">
          {formatNumber(kpiData.productCount)}
          <span className="text-lg font-normal text-slate-500 ml-2">รายการ</span>
        </p>

        {/* Description */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            จำนวนสินค้าที่แตกต่างกันในระบบ
          </p>
        </div>
      </div>
    </div>
  );
}