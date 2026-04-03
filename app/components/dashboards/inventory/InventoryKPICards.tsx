/**
 * Inventory KPI Cards Component - Modern Stripe Style
 * Location: app/components/dashboards/inventory/InventoryKPICards.tsx
 * ✅ Displays: 5 KPI cards with Accent Bar and SVG Icons
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
  
  const CARDS = [
    {
      label: "มูลค่าสต๊อครวม",
      value: formatCurrency(kpiData.totalValue),
      subText: "มูลค่ารวมสินค้าทั้งหมด",
      barColor: "bg-blue-500",
      iconBg: "bg-blue-500",
      textColor: "text-slate-800",
      subTextColor: "text-slate-400",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
    {
      label: "จำนวนประเภทสินค้า",
      value: `${formatNumber(kpiData.productCount)} รายการ`,
      subText: "สินค้าแตกต่างกันในระบบ",
      barColor: "bg-violet-500",
      iconBg: "bg-violet-500",
      textColor: "text-slate-800",
      subTextColor: "text-slate-400",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      ),
    },
    {
      label: "ใกล้หมด",
      value: `${formatNumber(kpiData.criticalStockCount)} รายการ`,
      subText: "ต้องสั่งซื้อด่วน",
      barColor: "bg-red-500",
      iconBg: "bg-red-500",
      textColor: "text-red-600",
      subTextColor: "text-red-400",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      ),
    },
    {
      label: "สต๊อกต่ำ",
      value: `${formatNumber(kpiData.lowStockCount)} รายการ`,
      subText: "ควรติดตามใกล้ชิด",
      barColor: "bg-orange-500",
      iconBg: "bg-orange-500",
      textColor: "text-orange-600",
      subTextColor: "text-orange-400",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
    {
      label: "สต๊อกปกติ",
      value: `${formatNumber(kpiData.normalStockCount)} รายการ`,
      subText: "สต๊อกเพียงพอ",
      barColor: "bg-emerald-500",
      iconBg: "bg-emerald-500",
      textColor: "text-emerald-600",
      subTextColor: "text-emerald-400",
      icon: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 w-full">
      {CARDS.map((card, idx) => (
        <div
          key={idx}
          className="relative bg-white rounded-2xl p-4 lg:p-5 border border-slate-100 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[150px]"
        >
          {/* ✅ แถบสีด้านล่าง (Accent Bar) */}
          <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${card.barColor}`} />

          <div>
            {/* Icon Header */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center shadow-md`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {card.icon}
                </svg>
              </div>
            </div>

            {/* Label */}
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 truncate">
              {card.label}
            </p>

            {/* Main Value */}
            <p className={`text-xl lg:text-2xl font-bold ${card.textColor} truncate`}>
              {card.value}
            </p>
          </div>

          {/* Footer Details */}
          <div className="mt-3 pt-3 border-t border-slate-50">
            <p className={`text-[10px] lg:text-xs font-medium ${card.subTextColor}`}>
              {card.subText}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}