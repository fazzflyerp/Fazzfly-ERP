"use client";
import type { FollowUp, Customer } from "@/app/components/crm/crm.types";
import { fmtDate } from "@/app/components/crm/crm.types";
import { getBranchCls } from "./CalTab";
import { useState } from "react";

interface Props {
  follows:         FollowUp[];
  branchId:        string;
  isSuperAdmin:    boolean;
  allBranches?:    { branchId: string; branchName: string }[];
  customers:       Customer[];
  onOpenFollow:    (c?: Customer) => void;
  onEditFollow:    (f: FollowUp) => void;
  updFollowStatus: (f: FollowUp, s: FollowUp["status"]) => void;
}

const F_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  pending: { label: "รอดำเนินการ", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30",      dot: "bg-rose-400" },
  done:    { label: "เสร็จแล้ว",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  skipped: { label: "ข้าม",        cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",   dot: "bg-slate-400" },
};

const todayStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function FollowTab({ follows, branchId, isSuperAdmin, allBranches = [], customers, onOpenFollow, onEditFollow, updFollowStatus }: Props) {
  const branchName = (bid: string) => allBranches.find(b => b.branchId === bid)?.branchName || bid;
  const [filter, setFilter] = useState<"pending" | "today" | "all">("pending");
  const [q, setQ] = useState("");
  const today = todayStr();

  // ไม่กรองสาขา — ทุกคนเห็นทั้งหมด แค่มี badge บอกสาขา
  const filtered = follows.filter(f => {
    if (filter === "pending") return f.status === "pending";
    if (filter === "today")   return f.due_date === today && f.status === "pending";
    return true;
  }).filter(f => !q || f.customer_name.includes(q) || f.task_type.includes(q));

  const pendingCount = follows.filter(f => f.status === "pending").length;
  const todayCount   = follows.filter(f => f.due_date === today && f.status === "pending").length;

  const isOverdue = (f: FollowUp) => f.status === "pending" && f.due_date < today;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 transition-colors" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {([["pending","รอดำเนินการ",pendingCount],["today","วันนี้",todayCount],["all","ทั้งหมด",follows.length]] as const).map(([k, lbl, cnt]) => (
            <button key={k} onClick={() => setFilter(k as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === k ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>
              {lbl}
              <span className={`min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${filter === k ? "bg-white/20" : "bg-white/[0.08]"}`}>{cnt}</span>
            </button>
          ))}
        </div>

        <button onClick={() => onOpenFollow()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          เพิ่มงาน
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-600">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          <p className="text-sm">ไม่มีงานในหมวดนี้</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(f => {
            const sc = F_STATUS[f.status] || F_STATUS.pending;
            const over = isOverdue(f);
            const custBranch = (f as any).branch_id;
            const branchLabel = custBranch ? branchName(custBranch) : "";
            return (
              <div key={f.task_id}
                className={`group flex items-start gap-4 p-4 rounded-xl border transition-colors
                  ${over ? "bg-red-500/5 border-red-500/20 hover:bg-red-500/8" : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.05]"}`}>

                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${sc.dot} ${f.status === "pending" ? "animate-pulse" : ""}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-semibold text-sm">{f.customer_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.cls}`}>{sc.label}</span>
                    {over && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">เกินกำหนด!</span>}
                    {isSuperAdmin && (() => {
                      const cls = getBranchCls(custBranch || "", allBranches);
                      return (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cls.bg} ${cls.text} ${cls.border}`}>
                          📍 {branchLabel || "ไม่ระบุสาขา"}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-slate-300 text-sm">{f.task_type}</p>
                  {f.description && <p className="text-slate-500 text-xs mt-0.5">{f.description}</p>}
                  <p className="text-slate-600 text-[11px] mt-1">📅 {fmtDate(f.due_date)} · {f.customer_phone}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {f.status === "pending" && (
                    <>
                      <button onClick={() => updFollowStatus(f, "done")} title="เสร็จแล้ว"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                      </button>
                      <button onClick={() => updFollowStatus(f, "skipped")} title="ข้าม"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                      </button>
                    </>
                  )}
                  <button onClick={() => onEditFollow(f)} title="แก้ไข"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
