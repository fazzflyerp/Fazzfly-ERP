/**
 * Debug Dashboard - Comprehensive Real-time Monitoring
 * Location: app/debug/page.tsx
 */

"use client";

import { useState, useEffect, useCallback } from "react";

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

type TabType = "overview" | "logs" | "errors" | "apis" | "session";

// ─── Level Badge ────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const cls =
    level === "ERROR"
      ? "bg-rose-100 text-rose-700 border border-rose-200"
      : level === "WARN"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : level === "INFO"
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : "bg-indigo-100 text-indigo-700 border border-indigo-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>
      {level}
    </span>
  );
}

// ─── API Health Bar ──────────────────────────────────────────────────────────
function ApiHealthBar({
  api,
  totalRequests,
  errorCount,
}: {
  api: string;
  totalRequests: number;
  errorCount: number;
}) {
  const errorPct = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  const barColor =
    errorPct === 0
      ? "bg-emerald-500"
      : errorPct < 10
      ? "bg-amber-400"
      : "bg-rose-500";

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-slate-600 w-48 truncate">{api}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(100, errorPct === 0 ? 100 : errorPct)}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-12 text-right">
        {errorPct.toFixed(1)}%
      </span>
      <span className="text-xs text-slate-400 w-16 text-right">
        {totalRequests} reqs
      </span>
    </div>
  );
}

// ─── Log Row ─────────────────────────────────────────────────────────────────
function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rowBg =
    log.level === "ERROR"
      ? "bg-rose-50 hover:bg-rose-100"
      : log.level === "WARN"
      ? "bg-amber-50 hover:bg-amber-100"
      : "hover:bg-slate-50";

  return (
    <>
      <tr
        className={`border-b border-slate-100 cursor-pointer transition-colors ${rowBg}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
          {new Date(log.timestamp).toLocaleTimeString("th-TH", { hour12: false })}
        </td>
        <td className="px-4 py-3">
          <LevelBadge level={log.level} />
        </td>
        <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
          {log.requestId.substring(0, 14)}…
        </td>
        <td className="px-4 py-3 text-xs font-mono text-indigo-700 whitespace-nowrap">
          {log.api}
        </td>
        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
          {log.userEmail || <span className="text-slate-300">-</span>}
        </td>
        <td className="px-4 py-3 text-sm text-slate-800 max-w-sm truncate">
          {log.message}
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap text-right">
          {log.duration ? `${log.duration}ms` : "-"}
        </td>
        <td className="px-4 py-3 text-slate-400 text-xs">
          {expanded ? "▲" : "▼"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Request ID
                  </span>
                  <p className="font-mono text-xs text-slate-700 mt-1">{log.requestId}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </span>
                  <p className="text-xs text-slate-700 mt-1">{log.timestamp}</p>
                </div>
              </div>
              {log.data && (
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Data
                  </span>
                  <pre className="mt-1 text-xs bg-white border border-slate-200 rounded-lg p-3 overflow-auto max-h-48 text-slate-700">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              )}
              {log.error && (
                <div>
                  <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
                    Error
                  </span>
                  <p className="mt-1 text-sm text-rose-700 font-medium">
                    {log.error.message}
                  </p>
                  {log.error.stack && (
                    <pre className="mt-2 text-xs bg-rose-50 border border-rose-200 rounded-lg p-3 overflow-auto max-h-64 text-rose-800">
                      {log.error.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DebugPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [filter, setFilter] = useState({
    level: "",
    api: "",
    search: "",
    limit: "100",
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ─── Fetch helpers ──────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filter.level) params.append("level", filter.level);
      if (filter.api) params.append("api", filter.api);
      params.append("limit", filter.limit);

      const res = await fetch(`/api/debug/logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filter.level, filter.api, filter.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/debug/logs?action=stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/debug/session");
      const data = await res.json();
      setSessionInfo(data);
    } catch (error) {
      console.error("Failed to fetch session:", error);
    }
  }, []);

  // ─── Auto-refresh ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchLogs();
    fetchStats();
    fetchSession();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
        fetchStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, fetchStats, fetchSession, autoRefresh]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const clearLogs = async () => {
    if (!confirm("ลบ logs ทั้งหมด?")) return;
    await fetch("/api/debug/logs", { method: "DELETE" });
    fetchLogs();
    fetchStats();
  };

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  // ─── Filtered logs ──────────────────────────────────────────────────────
  const filteredLogs = logs.filter((log) => {
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const inMessage = log.message.toLowerCase().includes(q);
      const inRequestId = log.requestId.toLowerCase().includes(q);
      const inEmail = (log.userEmail || "").toLowerCase().includes(q);
      if (!inMessage && !inRequestId && !inEmail) return false;
    }
    return true;
  });

  const errorLogs = logs.filter((l) => l.level === "ERROR");

  // ─── API stats table ────────────────────────────────────────────────────
  const apiTableData = stats
    ? Object.entries(stats.byApi)
        .map(([api, total]) => {
          const errors = logs.filter(
            (l) => l.api === api && l.level === "ERROR"
          ).length;
          const durations = logs
            .filter((l) => l.api === api && l.duration != null)
            .map((l) => l.duration as number);
          const avgDur =
            durations.length > 0
              ? Math.round(
                  durations.reduce((a, b) => a + b, 0) / durations.length
                )
              : 0;
          return { api, total, errors, errorPct: total > 0 ? (errors / total) * 100 : 0, avgDur };
        })
        .sort((a, b) => b.total - a.total)
    : [];

  // ─── UI helpers ─────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "logs", label: `Logs (${filteredLogs.length})` },
    { id: "errors", label: `Errors (${errorLogs.length})` },
    { id: "apis", label: "APIs" },
    { id: "session", label: "Session" },
  ];

  const errorRate =
    stats && stats.totalLogs > 0
      ? ((stats.errorCount / stats.totalLogs) * 100).toFixed(1)
      : "0.0";

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Debug Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time system monitoring &amp; log analysis
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator */}
            {autoRefresh && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                LIVE
              </div>
            )}

            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString("th-TH", { hour12: false })}
              </span>
            )}

            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                autoRefresh
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </button>

            <button
              onClick={() => { fetchLogs(); fetchStats(); }}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-white border border-b-white border-slate-200 text-indigo-600 -mb-px"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ──────────────── OVERVIEW TAB ──────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                {
                  label: "Total Logs",
                  value: stats?.totalLogs ?? "-",
                  color: "text-slate-900",
                  bg: "bg-white",
                },
                {
                  label: "Errors",
                  value: stats?.errorCount ?? "-",
                  color: "text-rose-600",
                  bg: "bg-rose-50",
                },
                {
                  label: "Warnings",
                  value: stats?.byLevel?.WARN ?? 0,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                },
                {
                  label: "Avg Duration",
                  value: stats ? `${stats.avgDuration}ms` : "-",
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                },
                {
                  label: "Active Users",
                  value: stats ? Object.keys(stats.byUser).length : "-",
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                },
                {
                  label: "Error Rate",
                  value: `${errorRate}%`,
                  color:
                    parseFloat(errorRate) === 0
                      ? "text-emerald-600"
                      : parseFloat(errorRate) < 5
                      ? "text-amber-600"
                      : "text-rose-600",
                  bg: "bg-white",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={`${card.bg} rounded-2xl p-5 shadow-sm border border-slate-100`}
                >
                  <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            {/* API Health bars */}
            {stats && Object.keys(stats.byApi).length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  API Health
                </h2>
                <div className="space-y-3">
                  {Object.entries(stats.byApi)
                    .sort(([, a], [, b]) => b - a)
                    .map(([api, total]) => {
                      const errors = logs.filter(
                        (l) => l.api === api && l.level === "ERROR"
                      ).length;
                      return (
                        <ApiHealthBar
                          key={api}
                          api={api}
                          totalRequests={total}
                          errorCount={errors}
                        />
                      );
                    })}
                </div>
              </div>
            )}

            {/* Level breakdown */}
            {stats && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  Log Level Breakdown
                </h2>
                <div className="grid grid-cols-4 gap-4">
                  {["DEBUG", "INFO", "WARN", "ERROR"].map((lvl) => {
                    const count = stats.byLevel[lvl] ?? 0;
                    const pct =
                      stats.totalLogs > 0
                        ? ((count / stats.totalLogs) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <div key={lvl} className="text-center">
                        <LevelBadge level={lvl} />
                        <p className="text-2xl font-bold text-slate-900 mt-2">
                          {count}
                        </p>
                        <p className="text-xs text-slate-400">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ──────────────── LOGS TAB ──────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <select
                  value={filter.level}
                  onChange={(e) => setFilter({ ...filter, level: e.target.value })}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">All Levels</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>

                <select
                  value={filter.api}
                  onChange={(e) => setFilter({ ...filter, api: e.target.value })}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">All APIs</option>
                  {stats &&
                    Object.keys(stats.byApi).map((api) => (
                      <option key={api} value={api}>
                        {api}
                      </option>
                    ))}
                </select>

                <input
                  type="text"
                  placeholder="Search message / requestId / user…"
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 col-span-2"
                />

                <select
                  value={filter.limit}
                  onChange={(e) => setFilter({ ...filter, limit: e.target.value })}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="50">Last 50</option>
                  <option value="100">Last 100</option>
                  <option value="500">Last 500</option>
                </select>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => setFilter({ level: "", api: "", search: "", limit: "100" })}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Clear filters
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={exportLogs}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-colors"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={clearLogs}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Time", "Level", "Request ID", "API", "User", "Message", "Duration", ""].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                          No logs found
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log, idx) => (
                        <LogRow
                          key={idx}
                          log={log}
                          expanded={expandedRow === idx}
                          onToggle={() =>
                            setExpandedRow(expandedRow === idx ? null : idx)
                          }
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── ERRORS TAB ────────────────────────────────── */}
        {activeTab === "errors" && (
          <div className="space-y-4">
            {errorLogs.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
                <p className="text-emerald-600 font-semibold text-lg">No errors found</p>
                <p className="text-slate-400 text-sm mt-1">System is running clean.</p>
              </div>
            ) : (
              errorLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <LevelBadge level="ERROR" />
                        <span className="font-mono text-xs text-slate-500">
                          {log.requestId}
                        </span>
                        <span className="text-xs text-indigo-600 font-mono">{log.api}</span>
                      </div>
                      <p className="font-semibold text-slate-900">{log.message}</p>
                      {log.userEmail && (
                        <p className="text-xs text-slate-500">User: {log.userEmail}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                      {new Date(log.timestamp).toLocaleString("th-TH")}
                    </span>
                  </div>

                  {log.error && (
                    <div className="space-y-2">
                      <p className="text-sm text-rose-700 font-medium">
                        {log.error.message}
                      </p>
                      {log.error.stack && (
                        <pre className="text-xs bg-rose-50 border border-rose-200 rounded-xl p-4 overflow-auto max-h-64 text-rose-800 leading-relaxed">
                          {log.error.stack}
                        </pre>
                      )}
                    </div>
                  )}

                  {log.data && (
                    <details>
                      <summary className="text-xs text-indigo-600 cursor-pointer font-medium">
                        Show data
                      </summary>
                      <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-48 text-slate-700">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ──────────────── APIS TAB ──────────────────────────────────── */}
        {activeTab === "apis" && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["API Endpoint", "Requests", "Errors", "Error %", "Avg Duration"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {apiTableData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                        No API data yet
                      </td>
                    </tr>
                  ) : (
                    apiTableData.map((row) => (
                      <tr key={row.api} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-indigo-700">
                          {row.api}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {row.total}
                        </td>
                        <td className="px-5 py-3 text-rose-600 font-semibold">
                          {row.errors}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`font-semibold ${
                              row.errorPct === 0
                                ? "text-emerald-600"
                                : row.errorPct < 10
                                ? "text-amber-600"
                                : "text-rose-600"
                            }`}
                          >
                            {row.errorPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {row.avgDur > 0 ? `${row.avgDur}ms` : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──────────────── SESSION TAB ───────────────────────────────── */}
        {activeTab === "session" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={fetchSession}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                Refresh Session
              </button>
            </div>

            {sessionInfo === null ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
                Loading session info…
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Session Info</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      key: "hasSession",
                      label: "Has Session",
                      value: sessionInfo?.hasSession,
                      isBool: true,
                    },
                    {
                      key: "userEmail",
                      label: "User Email",
                      value: sessionInfo?.userEmail || "-",
                      isBool: false,
                    },
                    {
                      key: "hasAccessToken",
                      label: "Has Access Token",
                      value: sessionInfo?.hasAccessToken,
                      isBool: true,
                    },
                    {
                      key: "expiresAt",
                      label: "Expires At",
                      value: sessionInfo?.expiresAt
                        ? new Date(sessionInfo.expiresAt).toLocaleString("th-TH")
                        : "-",
                      isBool: false,
                    },
                    {
                      key: "tokenStatus",
                      label: "Token Status",
                      value: sessionInfo?.tokenStatus || "-",
                      isBool: false,
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
                    >
                      <span className="text-sm text-slate-500 font-medium">
                        {item.label}
                      </span>
                      {item.isBool ? (
                        <span
                          className={`text-sm font-bold ${
                            item.value ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {item.value ? "Yes" : "No"}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-slate-800">
                          {String(item.value)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Raw JSON */}
                <details>
                  <summary className="text-xs text-indigo-600 cursor-pointer font-medium">
                    Show raw response
                  </summary>
                  <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto max-h-64 text-slate-700">
                    {JSON.stringify(sessionInfo, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
