/**
 * Sales Charts Component - Mobile/Tablet Friendly
 * Location: app/components/dashboards/sales/SalesCharts.tsx
 * ✅ Pie Chart, Line Chart, Waterfall Chart - Fully Responsive
 */

"use client";

import React, { useState } from "react";
import dynamic from 'next/dynamic';
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

// Import Plotly แบบ dynamic เพื่อป้องกัน SSR error
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface SalesChartsProps {
  pieChartData: any[];
  lineChartData: any[];
  waterfallData: any[];
}

const COLORS = [
  "#04469a", 
  "#ff7f09", 
  "#12b19cff",  
  "#2d8bba",  
  "#41b8d5", 
  "#6ce5e8",
  "#cfcdcd", 
  "#696565",
  "#70b8e4ff ",
  "#9fe2eaff",   
];

export default function SalesCharts({
  pieChartData,
  lineChartData,
  waterfallData,
}: SalesChartsProps) {
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [showTop10Only, setShowTop10Only] = useState(false);

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
{/* 3D Donut Chart: Popular Channels */}
{/* ============================================================ */}
{pieChartData.length > 0 && (
  <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
    <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
      <span className="text-lg lg:text-2xl"></span>
      ช่องทางนัดหมายยอดนิยม
    </h3>

    <div className="w-full" style={{ height: isMobile ? 350 : 450 }}>
      <Plot
        data={[
          {
            type: 'pie',
            labels: pieChartData.map(d => d.name),
            values: pieChartData.map(d => d.value),
            marker: {
              colors: COLORS,
              line: {
                color: '#0a0a0aff',
                width: 0
              }
            },
            textinfo: 'none',
            hovertemplate: '<b>%{label}</b><br>' +
                           'จำนวน: %{value:,.0f} รายการ<br>' +
                           'สัดส่วน: %{percent}<br>' +
                           '<extra></extra>',
            hole: 0.4,
            rotation: 0,
            direction: 'clockwise',
            sort: false,
          }
        ]}
        layout={{
          height: isMobile ? 350 : 450,
          showlegend: false,
          margin: { t: 40, b: 40, l: 40, r: 40 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: {
            family: 'Prompt, sans-serif',
            color: '#334155'
          }
        }}
        config={{
          displayModeBar: false,
          responsive: true,
          doubleClick: false,
          scrollZoom: false
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>

    {/* Legend - แบบเดิม */}
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
                <p className="font-medium text-lg font-bold truncate">{entry.name}</p>
                <p className="text-slate-500 text-medium font-medium">
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
{/* Line Chart: Sales Trend - Balanced & Clean */}
{/* ============================================================ */}
{lineChartData.length > 0 && (
  <div className="bg-white text-black rounded-xl lg:rounded-2xl p-4 lg:p-8 border border-slate-200 shadow-sm">
    <h3 className="text-lg lg:text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
      <span className="text-2xl lg:text-3xl"></span>
      <span>แนวโน้มยอดขาย</span>
    </h3>
    <ResponsiveContainer width="100%" height={isMobile ? 400 : 550}>
      <LineChart 
        data={lineChartData} 
        margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
      >
        {/* Grid */}
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#e2e8f0" 
          strokeOpacity={0.6}
          vertical={false}
        />
        
        {/* X-Axis - ปรับให้ไม่อัดกัน */}
        <XAxis 
          dataKey="date" 
          stroke="#64748b" 
          tick={{ fontSize: isMobile ? 11 : 14, fill: '#475569', fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
          height={70}
          angle={-45}
          textAnchor="end"
          interval={isMobile ? 'preserveStartEnd' : 0}
        />
        
        {/* Y-Axis */}
        <YAxis 
          stroke="#64748b" 
          tick={{ fontSize: isMobile ? 12 : 14, fill: '#475569', fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: '#cbd5e1', strokeWidth: 2 }}
          width={isMobile ? 60 : 80}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value;
          }}
        />
        
        {/* Tooltip */}
        <Tooltip
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            fontSize: "14px",
            padding: "12px 16px",
          }}
          itemStyle={{ 
            color: "#334155", 
            fontWeight: 600,
            padding: "4px 0",
            fontSize: "14px"
          }}
          labelStyle={{
            color: "#0f172a",
            fontWeight: 700,
            marginBottom: "8px",
            fontSize: "15px"
          }}
          cursor={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 5' }}
          formatter={(value: any) => {
            return [`${Number(value).toLocaleString('th-TH')} ฿`, ''];
          }}
        />
        
        {/* Legend */}
        <Legend 
          wrapperStyle={{ 
            fontSize: isMobile ? "13px" : "15px", 
            paddingTop: "20px",
            fontWeight: 600
          }}
          iconType="circle"
          iconSize={10}
        />
        
        {/* Line: ยอดขาย */}
        <Line
          type="monotone"
          dataKey="total_sales"
          name="ยอดขาย"
          stroke="#04469a"
          strokeWidth={2.5}
          dot={{
            fill: "#04469a",
            strokeWidth: 2,
            r: 4,
            stroke: "#ffffff",
          }}
          activeDot={{
            r: 7,
            fill: "#04469a",
            stroke: "#ffffff",
            strokeWidth: 3,
          }}
          isAnimationActive={!isMobile}
        />
        
        {/* Line: ต้นทุน */}
        <Line
          type="monotone"
          dataKey="cost"
          name="ต้นทุน"
          stroke="#ff7f09"
          strokeWidth={2.5}
          dot={{
            fill: "#ff7f09",
            strokeWidth: 2,
            r: 4,
            stroke: "#ffffff",
          }}
          activeDot={{
            r: 7,
            fill: "#ff7f09",
            stroke: "#ffffff",
            strokeWidth: 3,
          }}
          isAnimationActive={!isMobile}
        />
        
        {/* Line: กำไร */}
        <Line
          type="monotone"
          dataKey="profit"
          name="กำไร"
          stroke="#12b19cff"
          strokeWidth={2.5}
          dot={{
            fill: "#12b19cff",
            strokeWidth: 2,
            r: 4,
            stroke: "#ffffff",
          }}
          activeDot={{
            r: 7,
            fill: "#12b19cff",
            stroke: "#ffffff",
            strokeWidth: 3,
          }}
          isAnimationActive={!isMobile}
        />
      </LineChart>
    </ResponsiveContainer>

    {/* Summary Stats ด้านล่าง */}
    <div className="mt-6 pt-6 border-t border-slate-200">
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        <div className="text-center p-3 lg:p-4 bg-blue-50 rounded-xl">
          <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">ยอดขายรวม</p>
          <p className="text-base lg:text-xl font-bold text-blue-600">
            {lineChartData.reduce((sum, d) => sum + (d.total_sales || 0), 0).toLocaleString('th-TH')}
          </p>
        </div>
        <div className="text-center p-3 lg:p-4 bg-orange-50 rounded-xl">
          <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">ต้นทุนรวม</p>
          <p className="text-base lg:text-xl font-bold text-orange-600">
            {lineChartData.reduce((sum, d) => sum + (d.cost || 0), 0).toLocaleString('th-TH')}
          </p>
        </div>
        <div className="text-center p-3 lg:p-4 bg-green-50 rounded-xl">
          <p className="text-xs lg:text-sm text-slate-600 font-medium mb-1">กำไรรวม</p>
          <p className="text-base lg:text-xl font-bold text-green-600">
            {lineChartData.reduce((sum, d) => sum + (d.profit || 0), 0).toLocaleString('th-TH')}
          </p>
        </div>
      </div>
    </div>
  </div>
)}
 {/* ============================================================ */}
{/* Waterfall Chart: Profit by Program */}
{/* ============================================================ */}
{waterfallData.length > 0 && (
  <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-slate-200 shadow-sm">
    {/* Header with Toggle Button */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base lg:text-lg font-bold text-slate-800 flex items-center gap-2">
        <span className="text-lg lg:text-2xl"></span>
        <span>กำไรแยกตาม รายการ</span>
      </h3>
      
      {/* ✅ Toggle Button - Desktop/Tablet Only */}
      {!isMobile && waterfallData.length > 11 && (
        <button
          onClick={() => setShowTop10Only(!showTop10Only)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
            showTop10Only
              ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {showTop10Only ? ' Top 10' : '📋 ทั้งหมด'}
        </button>
      )}
    </div>

    <ResponsiveContainer width="100%" height={isMobile ? 300 : 500}>
      <BarChart
        data={
          isMobile 
            ? waterfallData.slice(0, 10) 
            : showTop10Only 
              ? waterfallData.slice(0, 10)
              : waterfallData
        }
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
          {(isMobile 
            ? waterfallData.slice(0, 10) 
            : showTop10Only 
              ? waterfallData.slice(0, 10)
              : waterfallData
          ).map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>

    {/* Mobile Notice */}
    {isMobile && waterfallData.length > 10 && (
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          📱 สำหรับ Mobile ระบบจะแสดง Top 10 ของรายการ จากทั้งหมด {waterfallData.length - 1} รายการ
        </p>
      </div>
    )}

    {/* Desktop/Tablet Notice */}
    {!isMobile && showTop10Only && waterfallData.length > 11 && (
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          กำลังแสดง Top 10 รายการ จากทั้งหมด {waterfallData.length - 1} รายการ
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
                <span>รายละเอียดกำไรแยกตาม แต่ละรายการ</span>
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
                        รายการ
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