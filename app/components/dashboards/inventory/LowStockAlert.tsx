/**
 * Low Stock Alert Component
 * Location: app/components/dashboards/inventory/LowStockAlert.tsx
 * ✅ Displays: Alert list for products with status "สต๊อกต่ำ" or "ใกล้หมด"
 */

"use client";

import React from "react";
import { LowStockItem, formatCurrency, getStatusColor, getStatusIcon } from "./inventoryUtils";

interface LowStockAlertProps {
  lowStockItems: LowStockItem[];
}

export default function LowStockAlert({
  lowStockItems,
}: LowStockAlertProps) {
  if (lowStockItems.length === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">✅</div>
          <div>
            <h3 className="text-lg font-bold text-green-800">สต๊อกปกติ</h3>
            <p className="text-sm text-green-600 mt-1">
              ไม่มีสินค้าที่ใกล้หมดหรือสต๊อกต่ำในขณะนี้
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-red-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl"></span>
              แจ้งเตือนสต๊อกสินค้า
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              สินค้าที่มีสต๊อกต่ำหรือใกล้หมด
            </p>
          </div>
          <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-bold">
            {lowStockItems.length} รายการ
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="divide-y divide-slate-100">
        {lowStockItems.map((item, index) => {
          const statusColor = getStatusColor(item.status);
          const statusIcon = getStatusIcon(item.status);

          return (
            <div
              key={index}
              className="p-4 lg:p-6 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{statusIcon}</span>
                    <h4 className="text-base font-bold text-slate-800 truncate">
                      {item.product}
                    </h4>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">คงเหลือ:</span>
                      <span className="font-bold" style={{ color: statusColor }}>
                        {item.remain}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">มูลค่าสต๊อค:</span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(item.stockprice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Status Badge */}
                <div>
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: `${statusColor}20`,
                      color: statusColor,
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}