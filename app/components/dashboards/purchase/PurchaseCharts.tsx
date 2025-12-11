/**
 * Purchase Charts Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/purchase/PurchaseCharts.tsx
 * ✅ Pie Chart, Line Chart - Fully Responsive
 */

"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface PurchaseChartsProps {
  pieChartData: any[];
  lineChartData: any[];
}

const COLORS = [
  "#e18ee2ff",
  "#5B5FAE",
  "#3F86F7",
  "#79A9E0",
  "#F5D4EA",
  "#ed71afff",
  "#C9B7EB",
  "#40347A",
];

export default function PurchaseCharts({
  pieChartData,
  lineChartData,
}: PurchaseChartsProps) {
  // Detect screen size for responsive chart sizing
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* ============================================================ */}
      {/* Pie Chart: ต้นทุนแยกตามสินค้า */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"> </span>
            ต้นทุนแยกตามสินค้า
          </h3>

          <div className="flex justify-center items-center w-full">
            <ResponsiveContainer
              width="100%"
              height={isMobile ? 300 : 350}
            >
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 90 : 120}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value: number, name: string) => {
                    const total = pieChartData.reduce(
                      (acc, d) => acc + d.value,
                      0
                    );
                    const percent = (value / total) * 100;
                    return [
                      `${value.toLocaleString("th-TH", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })} บาท (${percent.toFixed(1)}%)`,
                      name,
                    ];
                  }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#334155", fontWeight: 500 }}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend - Responsive Grid */}
          <div className="mt-4 lg:mt-6">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
              {[...pieChartData]
                .sort((a, b) => b.value - a.value)
                .map((entry, index) => (
                  <li
                    key={`legend-${index}`}
                    className="flex items-center gap-2 text-xs lg:text-sm text-slate-700 p-2 lg:p-3 bg-slate-50 rounded-lg"
                  >
                    <span
                      className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{entry.name}</p>
                      <p className="text-slate-500 text-xs">
                        {entry.value.toLocaleString("th-TH", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })} บาท (
                        {(
                          (entry.value /
                            pieChartData.reduce((acc, d) => acc + d.value, 0)) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Line Chart: แนวโน้มต้นทุนรายวัน */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            <span>แนวโน้มต้นทุนรายวัน</span>
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <LineChart data={lineChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={isMobile ? 35 : 45} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              <Line
                type="monotone"
                dataKey="quantity"
                name="จำนวน"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
                isAnimationActive={!isMobile}
              />
              <Line
                type="monotone"
                dataKey="cost"
                name="ต้นทุน"
                stroke="#ef4444"
                dot={false}
                strokeWidth={2}
                isAnimationActive={!isMobile}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}