/**
 * Sales Charts Component
 * Location: app/components/dashboards/sales/SalesCharts.tsx
 * ✅ Displays: Pie Chart, Line Chart, Waterfall Chart
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
  BarChart,
  Bar,
} from "recharts";

interface SalesChartsProps {
  pieChartData: any[];
  lineChartData: any[];
  waterfallData: any[];
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

export default function SalesCharts({
  pieChartData,
  lineChartData,
  waterfallData,
}: SalesChartsProps) {
  const [showProgramDetails, setShowProgramDetails] = useState(false);

  return (
    <>
      {/* ============================================================ */}
      {/* Pie Chart: ช่องทางนัดหมาย */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            ช่องทางนัดหมายลูกค้า ยอดนิยม
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
                      `${value.toLocaleString("th-TH")} รายการ (${percent.toFixed(
                        1
                      )}%)`,
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
                      ({entry.value.toLocaleString("th-TH")} รายการ |{" "}
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
      {/* Line Chart */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            📈 แนวโน้มยอดขาย
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {["total_sales", "cost", "profit"].map((fieldName, idx) => (
                <Line
                  key={fieldName}
                  type="monotone"
                  dataKey={fieldName}
                  stroke={COLORS[idx % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ============================================================ */}
      {/* Waterfall Chart: กำไรแยกตาม Program */}
      {/* ============================================================ */}
      {waterfallData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            💰 กำไรแยกตาม Program (Waterfall Chart)
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis stroke="#64748b" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return (
                      <div
                        style={{
                          backgroundColor: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <p className="font-semibold text-slate-800 mb-2">
                          {data.name}
                        </p>
                        <p className="text-sm text-slate-600">
                          กำไร:{" "}
                          <span className="font-semibold text-green-600">
                            {data.value.toLocaleString("th-TH", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{" "}
                            บาท
                          </span>
                        </p>
                        {data.sales !== undefined && (
                          <p className="text-sm text-slate-600">
                            ยอดขาย:{" "}
                            <span className="font-semibold">
                              {data.sales.toLocaleString("th-TH", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}{" "}
                              บาท
                            </span>
                          </p>
                        )}
                        {data.profitMargin !== undefined && (
                          <p className="text-sm text-slate-600">
                            % กำไร:{" "}
                            <span className="font-semibold text-blue-600">
                              {data.profitMargin.toFixed(1)}%
                            </span>
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar dataKey="value" name="กำไร">
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">กำไรรวมทั้งหมด:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {waterfallData[waterfallData.length - 1]?.end.toLocaleString(
                    "th-TH",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }
                  )}{" "}
                  บาท
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">% กำไรรวม:</span>
                <span className="text-2xl font-bold text-green-600">
                  {waterfallData[waterfallData.length - 1]?.profitMargin?.toFixed(
                    1
                  ) || "0"}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Profit Margin Table */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-slate-700">
                รายละเอียดกำไรแยกตามโปรแกรม
              </h4>
              <button
                onClick={() =>
                  setShowProgramDetails(!showProgramDetails)
                }
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {showProgramDetails ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    ซ่อนรายละเอียด
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    แสดงรายละเอียด
                  </>
                )}
              </button>
            </div>

            {showProgramDetails && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="px-4 py-3 text-left font-bold text-slate-700">
                        โปรแกรม
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">
                        ยอดขาย
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">
                        กำไร
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700">
                        % กำไร
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {waterfallData.slice(0, -1).map((item, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {item.sales?.toLocaleString("th-TH", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }) || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {item.value.toLocaleString("th-TH", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              item.profitMargin >= 30
                                ? "bg-green-100 text-green-700"
                                : item.profitMargin >= 15
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.profitMargin?.toFixed(1) || "0"}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="border-t-2 border-slate-300 bg-blue-50 font-bold">
                      <td className="px-4 py-3 text-slate-800">รวมทั้งหมด</td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {waterfallData[waterfallData.length - 1]?.sales?.toLocaleString(
                          "th-TH",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        ) || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700">
                        {waterfallData[waterfallData.length - 1]?.value.toLocaleString(
                          "th-TH",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {waterfallData[waterfallData.length - 1]?.profitMargin?.toFixed(
                            1
                          ) || "0"}
                          %
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}