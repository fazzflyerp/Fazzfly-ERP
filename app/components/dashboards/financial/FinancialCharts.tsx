/**
 * Financial Charts Component
 * Location: app/components/dashboards/financial/FinancialCharts.tsx
 * ✅ Charts: Stacked Bar, Area, Gauge
 */

"use client";

import React from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getProfitMarginColor, getProfitMarginLabel } from "@/app/components/dashboards/financial/financialUtils";

interface FinancialChartsProps {
  stackedBarData: any[];
  areaChartData: any[];
  gaugeValue: number;
}

export default function FinancialCharts({
  stackedBarData,
  areaChartData,
  gaugeValue,
}: FinancialChartsProps) {
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Stacked Bar + Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span>
            รายรับ vs รายจ่ายแยกตามช่วง
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stackedBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat("th-TH", {
                    style: "currency",
                    currency: "THB",
                  }).format(value),
                ]}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar 
                dataKey="total_sales" 
                name="รายได้" 
                fill="#10b981" 
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="cost" 
                name="ต้นทุน" 
                fill="#ef4444" 
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="expense" 
                name="ค่าใช้จ่าย" 
                fill="#f59e0b" 
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-2xl"></span>
            แนวโน้มกำไรขั้นต้นและกำไรสุทธิ
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={areaChartData}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorNetProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                tickFormatter={formatCurrency}
              />
              <Tooltip
                formatter={(value: number) => [
                  new Intl.NumberFormat("th-TH", {
                    style: "currency",
                    currency: "THB",
                  }).format(value),
                ]}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="profit"
                name="กำไรขั้นต้น"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorProfit)"
              />
              <Area
                type="monotone"
                dataKey="net_profit"
                name="กำไรสุทธิ"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorNetProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Gauge Chart (Full Width) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-2xl"></span>
          อัตรากำไรสุทธิเฉลี่ย
        </h3>
        
        <div className="flex flex-col items-center justify-center py-5">
          {/* Gauge Visual */}
          <div className="relative w-64 h-40 overflow-visible">
            {/* Background Arc */}
            <svg viewBox="0 0 200 100" className="w-full h-full">
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="20"
                strokeLinecap="round"
              />
              {/* Colored Arc */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke={getProfitMarginColor(gaugeValue)}
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${(gaugeValue / 100) * 251.2} 251.2`}
              />
              {/* Center Text */}
              <text
                x="100"
                y="70"
                textAnchor="middle"
                className="text-4xl font-bold"
                fill={getProfitMarginColor(gaugeValue)}
              >
                {gaugeValue.toFixed(1)}%
              </text>
            </svg>
          </div>

          {/* Label */}
          <div className="mt-4 text-center">
            <p className="text-xl font-semibold" style={{ color: getProfitMarginColor(gaugeValue) }}>
              {getProfitMarginLabel(gaugeValue)}
            </p>
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm text-slate-600">&lt;10% ควรปรับปรุง</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              <span className="text-sm text-slate-600">10-20% พอใช้</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-sm text-slate-600">20-30% ดี</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-slate-600">≥30% ดีมาก</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}