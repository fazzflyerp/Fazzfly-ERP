/**
 * Auto-Generated Dashboard Component
 * Location: app/components/DashboardRenderer.tsx
 */

"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface DashboardRendererProps {
  spreadsheetId: string;
  configSheetName: string;
  dataSheetName: string;
  accessToken: string;
}

interface ConfigField {
  fieldName: string;
  label: string;
  type: string;
  order: number;
}

interface DashboardConfig {
  dateFields: ConfigField[];
  numberFields: ConfigField[];
  textFields: ConfigField[];
  periodField: ConfigField | null;
}

interface DashboardData {
  config: DashboardConfig;
  visualizations: any;
  lineChartData?: any[];
  rankingTableData?: any[];
  kpiData?: { [key: string]: any };
  periodOptions?: string[];
  selectedPeriod?: string;
}

const colors = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
];

export default function DashboardRenderer({
  spreadsheetId,
  configSheetName,
  dataSheetName,
  accessToken,
}: DashboardRendererProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const fetchDashboardData = async (period?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        spreadsheetId,
        configSheetName,
        dataSheetName,
        ...(period && { period }),
      });

      const response = await fetch(`/api/dashboard/data?${params}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
      setSelectedPeriod(dashboardData.selectedPeriod || "");
    } catch (err: any) {
      console.error("Error fetching dashboard:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    fetchDashboardData(period);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลด Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700 font-semibold">❌ เกิดข้อผิดพลาด</p>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div>ไม่มีข้อมูล</div>;
  }

  return (
    <div className="space-y-8">
      {/* Period Filter */}
      {data.periodOptions && data.periodOptions.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-slate-700">ช่วงเวลา:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">ทั้งหมด</option>
            {data.periodOptions.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPI Cards */}
      {data.visualizations.hasKPICards && data.kpiData && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.config.numberFields.map((field, idx) => {
            const kpi = data.kpiData![field.fieldName];
            return (
              <div
                key={field.fieldName}
                className="bg-white rounded-xl shadow p-6 border-l-4"
                style={{ borderColor: colors[idx % colors.length] }}
              >
                <p className="text-sm text-slate-600 font-medium">{field.label}</p>
                <p className="text-3xl font-bold mt-2">{kpi.sum.toLocaleString()}</p>
                <div className="text-xs text-slate-500 mt-3 space-y-1">
                  <p>ค่าเฉลี่ย: {kpi.avg.toFixed(2)}</p>
                  <p>จำนวน: {kpi.count}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Line Chart */}
      {data.visualizations.hasLineChart && data.lineChartData && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            📈 {data.config.dateFields[0]?.label} vs {data.config.numberFields.map((f) => f.label).join(", ")}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data.lineChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              {data.config.numberFields.map((field, idx) => (
                <Line
                  key={field.fieldName}
                  type="monotone"
                  dataKey={field.fieldName}
                  name={field.label}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ranking Table */}
      {data.visualizations.hasRankingTable && data.rankingTableData && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            🏆 Top {data.rankingTableData.length} - {data.config.textFields[0]?.label}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-slate-300">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    ลำดับ
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">
                    {data.config.textFields[0]?.label}
                  </th>
                  {data.config.numberFields.map((field) => (
                    <th
                      key={field.fieldName}
                      className="text-right py-3 px-4 font-semibold text-slate-700"
                    >
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rankingTableData.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600">#{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {row[data.config.textFields[0]?.fieldName]}
                    </td>
                    {data.config.numberFields.map((field) => (
                      <td
                        key={field.fieldName}
                        className="text-right py-3 px-4 text-slate-700"
                      >
                        {parseFloat(row[field.fieldName] || 0).toLocaleString(
                          "th-TH",
                          { maximumFractionDigits: 2 }
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No visualizations */}
      {!data.visualizations.hasLineChart &&
        !data.visualizations.hasRankingTable &&
        !data.visualizations.hasKPICards && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <p className="text-blue-700 font-semibold">
              ⚠️ ไม่สามารถสร้าง Dashboard
            </p>
            <p className="text-blue-600 text-sm mt-2">
              ตรวจสอบให้แน่ใจว่า config sheet มี date field, number field, หรือ text field
            </p>
          </div>
        )}
    </div>
  );
}