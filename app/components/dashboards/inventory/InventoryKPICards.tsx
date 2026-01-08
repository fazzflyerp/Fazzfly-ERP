/**
 * Inventory KPI Cards Component
 * Location: app/components/dashboards/inventory/InventoryKPICards.tsx
 * ✅ Displays: 5 KPI cards (Total Value + Product Count + Status Counts)
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
      {/* Card 1: Total Stock Value */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-4 lg:p-6 border-2 border-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-xl lg:text-2xl shadow-lg">
            💰
          </div>
        </div>
        <p className="text-xs font-bold text-slate-600 mb-2">มูลค่าสต๊อครวม</p>
        <p className="text-2xl lg:text-3xl font-bold text-slate-800 mb-3">
          {formatCurrency(kpiData.totalValue)}
        </p>
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">มูลค่ารวมของสินค้าทั้งหมด</p>
        </div>
      </div>

      {/* Card 2: Product Count */}
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-4 lg:p-6 border-2 border-purple-100 hover:shadow-xl hover:scale-105 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white text-xl lg:text-2xl shadow-lg">
            📦
          </div>
        </div>
        <p className="text-xs font-bold text-slate-600 mb-2">จำนวนประเภทสินค้า</p>
        <p className="text-2xl lg:text-3xl font-bold text-slate-800 mb-3">
          {formatNumber(kpiData.productCount)}
          <span className="text-sm font-normal text-slate-500 ml-2">รายการ</span>
        </p>
        <div className="pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">สินค้าแตกต่างกันในระบบ</p>
        </div>
      </div>

      {/* Card 3: Critical Stock (ใกล้หมด) */}
      <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl p-4 lg:p-6 border-2 border-red-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white text-xl lg:text-2xl shadow-lg">
            🔴
          </div>
        </div>
        <p className="text-xs font-bold text-slate-600 mb-2">ใกล้หมด</p>
        <p className="text-2xl lg:text-3xl font-bold text-red-600 mb-3">
          {formatNumber(kpiData.criticalStockCount)}
          <span className="text-sm font-normal text-slate-500 ml-2">รายการ</span>
        </p>
        <div className="pt-3 border-t border-red-200">
          <p className="text-xs text-red-600 font-medium"> ต้องสั่งซื้อด่วน</p>
        </div>
      </div>

      {/* Card 4: Low Stock (สต๊อกต่ำ) */}
      <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl p-4 lg:p-6 border-2 border-orange-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xl lg:text-2xl shadow-lg">
            🟠
          </div>
        </div>
        <p className="text-xs font-bold text-slate-600 mb-2">สต๊อกต่ำ</p>
        <p className="text-2xl lg:text-3xl font-bold text-orange-600 mb-3">
          {formatNumber(kpiData.lowStockCount)}
          <span className="text-sm font-normal text-slate-500 ml-2">รายการ</span>
        </p>
        <div className="pt-3 border-t border-orange-200">
          <p className="text-xs text-orange-600 font-medium"> ควรติดตามใกล้ชิด</p>
        </div>
      </div>

      {/* Card 5: Normal Stock (ปกติ) */}
      <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl p-4 lg:p-6 border-2 border-green-200 hover:shadow-xl hover:scale-105 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white text-xl lg:text-2xl shadow-lg">
            🟢
          </div>
        </div>
        <p className="text-xs font-bold text-slate-600 mb-2">สต๊อกปกติ</p>
        <p className="text-2xl lg:text-3xl font-bold text-green-600 mb-3">
          {formatNumber(kpiData.normalStockCount)}
          <span className="text-sm font-normal text-slate-500 ml-2">รายการ</span>
        </p>
        <div className="pt-3 border-t border-green-200">
          <p className="text-xs text-green-600 font-medium"> สต๊อกเพียงพอ</p>
        </div>
      </div>
    </div>
  );
}