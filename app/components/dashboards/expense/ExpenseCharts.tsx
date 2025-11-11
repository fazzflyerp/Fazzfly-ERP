/**
 * Expense Charts Component
 * Location: app/components/dashboards/expense/ExpenseCharts.tsx
 * ✅ Displays: Pie Chart (by category), Line Chart (trend)
 */

"use client";

import React from "react";
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

interface ExpenseChartsProps {
  pieChartData: any[];
  lineChartData: any[];
}

const COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];

export default function ExpenseCharts({
  pieChartData,
  lineChartData,
}: ExpenseChartsProps) {
  return (
    <>
      {/* ============================================================ */}
      {/* Pie Chart: สัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่ */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            📊 สัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่
          </h3>

          <div className="flex justify-center items-center w-full">
            <ResponsiveContainer
              width="100%"
              height={window.innerWidth < 640 ? 350 : 300}
            >
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={window.innerWidth < 640 ? 110 : 150}
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
                    borderRadius: "10px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                    fontSize: "13px",
                  }}
                  itemStyle={{ color: "#334155", fontWeight: 500 }}
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-5">
            <ul className="flex flex-wrap justify-center gap-4">
              {[...pieChartData]
                .sort((a, b) => b.value - a.value)
                .map((entry, index) => (
                  <li
                    key={`legend-${index}`}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <span
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-slate-500 text-xs">
                      (
                      {entry.value.toLocaleString("th-TH", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                      บาท |{" "}
                      {(
                        (entry.value /
                          pieChartData.reduce((acc, d) => acc + d.value, 0)) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Line Chart: แนวโน้มค่าใช้จ่ายรายวัน */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            📈 แนวโน้มค่าใช้จ่ายรายวัน
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${value.toLocaleString("th-TH", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })} บาท`,
                  "ค่าใช้จ่าย",
                ]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                name="ค่าใช้จ่าย"
                stroke="#ef4444"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}