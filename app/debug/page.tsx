/**
 * Debug Dashboard - Real-time Monitoring ✅
 * Location: app/debug/page.tsx
 */

"use client";

import { useState, useEffect } from "react";

interface LogEntry {
  timestamp: string;
  requestId: string;
  level: string;
  api: string;
  userEmail?: string;
  message: string;
  data?: any;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

interface Stats {
  totalLogs: number;
  byLevel: Record<string, number>;
  byApi: Record<string, number>;
  byUser: Record<string, number>;
  errorCount: number;
  avgDuration: number;
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState({
    level: "",
    api: "",
    userEmail: "",
    requestId: "",
    limit: "100",
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLogs();
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [filter, autoRefresh]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      if (filter.level) params.append("level", filter.level);
      if (filter.api) params.append("api", filter.api);
      if (filter.userEmail) params.append("userEmail", filter.userEmail);
      if (filter.requestId) params.append("requestId", filter.requestId);
      if (filter.limit) params.append("limit", filter.limit);

      const res = await fetch(`/api/debug/logs?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/debug/logs?action=stats");
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const clearFilters = () => {
    setFilter({
      level: "",
      api: "",
      userEmail: "",
      requestId: "",
      limit: "100",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">🐛 Debug Console</h1>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Auto-refresh (5s)</span>
            </label>
            
            <button
              onClick={() => {
                fetchLogs();
                fetchStats();
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Refresh Now"}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Total Logs</div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalLogs}</div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg shadow">
              <div className="text-sm text-red-600">Errors</div>
              <div className="text-2xl font-bold text-red-700">{stats.errorCount}</div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg shadow">
              <div className="text-sm text-blue-600">Avg Duration</div>
              <div className="text-2xl font-bold text-blue-700">{stats.avgDuration}ms</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg shadow">
              <div className="text-sm text-green-600">Active Users</div>
              <div className="text-2xl font-bold text-green-700">
                {Object.keys(stats.byUser).length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg text-black shadow mb-6">
          <div className="grid grid-cols-5 gap-4 mb-3">
            <select
              value={filter.level}
              onChange={(e) => setFilter({ ...filter, level: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>

            <input
              type="text"
              placeholder="Filter by API..."
              value={filter.api}
              onChange={(e) => setFilter({ ...filter, api: e.target.value })}
              className="border rounded px-3 py-2"
            />

            <input
              type="text"
              placeholder="Filter by User..."
              value={filter.userEmail}
              onChange={(e) => setFilter({ ...filter, userEmail: e.target.value })}
              className="border rounded px-3 py-2"
            />

            <input
              type="text"
              placeholder="Filter by Request ID..."
              value={filter.requestId}
              onChange={(e) => setFilter({ ...filter, requestId: e.target.value })}
              className="border rounded px-3 py-2"
            />

            <select
              value={filter.limit}
              onChange={(e) => setFilter({ ...filter, limit: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
              <option value="500">Last 500</option>
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Request ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    API
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr
                      key={idx}
                      className={
                        log.level === "ERROR"
                          ? "bg-red-50"
                          : log.level === "WARN"
                          ? "bg-yellow-50"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            log.level === "ERROR"
                              ? "bg-red-100 text-red-800"
                              : log.level === "WARN"
                              ? "bg-yellow-100 text-yellow-800"
                              : log.level === "INFO"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">
                        {log.requestId}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        {log.api}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.userEmail || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-md">
                          {log.message}
                          {log.data && (
                            <details className="mt-1">
                              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                                Show data
                              </summary>
                              <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </details>
                          )}
                          {log.error && (
                            <div className="mt-1">
                              <div className="text-xs text-red-600 font-medium">
                                Error: {log.error.message}
                              </div>
                              {log.error.stack && (
                                <details className="mt-1">
                                  <summary className="text-xs text-red-600 cursor-pointer">
                                    Stack trace
                                  </summary>
                                  <pre className="mt-1 text-xs bg-red-50 p-2 rounded overflow-auto max-h-40">
                                    {log.error.stack}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {log.duration ? `${log.duration}ms` : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}