/**
 * Sales Charts Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/sales/SalesCharts.tsx
 * ✅ Pie Chart, Line Chart, Waterfall Chart - Fully Responsive
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
  "#7054fc",  
  "#ff66c4",  
  "#87cd2cff",  
  "#fff56d",  
  "#f15a6eff",  
  "#7f88f0ff", 
  "#ec6e74ff",
  "#25c9dcff",
  "#dc255cff",
];

export default function SalesCharts({
  pieChartData,
  lineChartData,
  waterfallData,
}: SalesChartsProps) {
  const [showProgramDetails, setShowProgramDetails] = useState(false);

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
      {/* Pie Chart: Popular Channels */}
      {/* ============================================================ */}
      {pieChartData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            ช่องทางนัดหมายยอดนิยม
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
                  outerRadius={isMobile ? 90 : 130}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="none"
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
                        {entry.value.toLocaleString("th-TH")} รายการ (
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
      {/* Line Chart: Sales Trend */}
      {/* ============================================================ */}
      {lineChartData.length > 0 && (
        <div className="bg-white text-black rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            <span>แนวโน้มยอดขาย</span>
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
              {["total_sales", "cost", "profit"].map((fieldName, idx) => (
                <Line
                  key={fieldName}
                  type="monotone"
                  dataKey={fieldName}
                  stroke={COLORS[idx % COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={!isMobile}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ============================================================ */}
      {/* Waterfall Chart: Profit by Program */}
      {/* ============================================================ */}
      {waterfallData.length > 0 && (
        <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="text-lg lg:text-2xl"></span>
            <span>กำไรแยกตาม Program</span>
          </h3>

          <ResponsiveContainer width="100%" height={isMobile ? 300 : 500}>
            <BarChart
              data={isMobile ? waterfallData.slice(0, 10) : waterfallData}
              margin={{ top: 20, right: 10, left: isMobile ? 0 : 10, bottom: isMobile ? 60 : 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={isMobile ? 60 : 100}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} width={isMobile ? 40 : 50} />
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
                          padding: "8px 10px",
                          fontSize: "12px",
                        }}
                      >
                        <p className="font-semibold text-slate-800 mb-1">
                          {data.name}
                        </p>
                        <p className="text-xs text-slate-600">
                          กำไร:{" "}
                          <span className="font-semibold text-green-600">
                            {data.value.toLocaleString("th-TH", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </p>
                        {data.sales !== undefined && (
                          <p className="text-xs text-slate-600">
                            ยอดขาย:{" "}
                            <span className="font-semibold">
                              {data.sales.toLocaleString("th-TH", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </p>
                        )}
                        {data.profitMargin !== undefined && (
                          <p className="text-xs text-slate-600">
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
              <Bar dataKey="value" name="">
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Mobile Notice */}
          {isMobile && waterfallData.length > 10 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                สำหรับ Moblie ระบบจะแสดง 10 โปรแกรมยอดนิยม จากทั้งหมด {waterfallData.length - 1} โปรแกรม
              </p>
            </div>
          )}

          {/* Summary - Responsive Grid */}
          <div className="mt-4 lg:mt-6 pt-4 lg:pt-6 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 lg:p-4 bg-blue-50 rounded-lg">
                <span className="text-xs lg:text-sm text-slate-600 font-medium mb-2 sm:mb-0">
                  กำไรรวมทั้งหมด:
                </span>
                <span className="text-lg lg:text-2xl font-bold text-blue-600">
                  {waterfallData[waterfallData.length - 1]?.end.toLocaleString(
                    "th-TH",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }
                  )}{" "}
                  <span className="text-xs lg:text-sm">บาท</span>
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 lg:p-4 bg-green-50 rounded-lg">
                <span className="text-xs lg:text-sm text-slate-600 font-medium mb-2 sm:mb-0">
                  % กำไร:
                </span>
                <span className="text-lg lg:text-2xl font-bold text-green-600">
                  {waterfallData[waterfallData.length - 1]?.profitMargin?.toFixed(
                    1
                  ) || "0"}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Program Details - Collapsible - Tablet + Desktop */}
          <div className="hidden md:block mt-4 md:mt-6">
            <button
              onClick={() => setShowProgramDetails(!showProgramDetails)}
              className="w-full flex items-center justify-between px-3 md:px-4 py-2 md:py-3 
               text-xs md:text-sm font-medium text-slate-700 bg-slate-100 
               hover:bg-slate-200 rounded-lg transition-colors active:scale-95 
               md:active:scale-100"
            >
              <span className="flex items-center gap-2">
                <span>รายละเอียดกำไรแยกตาม Program</span>
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${showProgramDetails ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProgramDetails && (
              <div className="mt-3 md:mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs lg:text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="px-2 lg:px-4 py-2 lg:py-3 text-left font-bold text-slate-700">
                        โปรแกรม
                      </th>
                      <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                        ยอดขาย
                      </th>
                      <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                        กำไร
                      </th>
                      <th className="px-2 lg:px-4 py-2 lg:py-3 text-right font-bold text-slate-700 whitespace-nowrap">
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
                        <td className="px-2 lg:px-4 py-2 lg:py-3 font-medium text-slate-800 truncate">
                          {item.name}
                        </td>
                        <td className="px-2 lg:px-4 py-2 lg:py-3 text-right text-slate-700 whitespace-nowrap text-xs lg:text-sm">
                          ฿{item.sales?.toLocaleString("th-TH", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }) || "-"}
                        </td>
                        <td className="px-2 lg:px-4 py-2 lg:py-3 text-right font-semibold text-green-600 whitespace-nowrap text-xs lg:text-sm">
                          ฿{item.value.toLocaleString("th-TH", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-2 lg:px-4 py-2 lg:py-3 text-right">
                          <span
                            className={`inline-flex items-center px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full text-xs font-semibold whitespace-nowrap ${item.profitMargin >= 30
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
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-slate-800">รวมทั้งหมด</td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-right text-slate-800 text-xs lg:text-sm">
                        {waterfallData[waterfallData.length - 1]?.sales?.toLocaleString(
                          "th-TH",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        ) || "-"}
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-right text-blue-700 text-xs lg:text-sm">
                        {waterfallData[waterfallData.length - 1]?.value.toLocaleString(
                          "th-TH",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }
                        )}
                      </td>
                      <td className="px-2 lg:px-4 py-2 lg:py-3 text-right">
                        <span className="inline-flex items-center px-1.5 lg:px-2 py-0.5 lg:py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
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
    </div>
  );
}