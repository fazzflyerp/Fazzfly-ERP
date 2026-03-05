// app/components/crm/FollowsTab.tsx
"use client";
import { Ic, IC, Badge } from "@/app/components/crm/crm.ui";
import { F_CFG, fmtDate, todayStr } from "@/app/components/crm/crm.types";
import type { FollowUp } from "@/app/components/crm/crm.types";

interface Props {
  follows: FollowUp[];
  followQ: string; setFollowQ: (q: string) => void;
  followF: "all" | "pending" | "today"; setFollowF: (f: "all" | "pending" | "today") => void;
  openFollow: () => void;
  updFollowStatus: (f: FollowUp, s: FollowUp["status"]) => void;
  onEditFollow: (f: FollowUp) => void;
}

export default function FollowsTab({ follows, followQ, setFollowQ, followF, setFollowF, openFollow, updFollowStatus, onEditFollow }: Props) {
  const today = todayStr();

  // อิง reminded_at — ถ้าไม่มี reminded_at ให้ fallback due_date
  const remindDate = (f: FollowUp) => f.reminded_at || f.due_date;
  const isOverdue  = (f: FollowUp) => f.status === "pending" && !!remindDate(f) && remindDate(f) < today;
  const isDueToday = (f: FollowUp) => f.status === "pending" && remindDate(f) === today;

  const pending = follows.filter(f => f.status === "pending");
  const filtered = follows.filter(f => {
    const q  = `${f.customer_name}${f.task_type}`.toLowerCase().includes(followQ.toLowerCase());
    const fl = followF === "all"
      ? true
      : followF === "pending"
      ? f.status === "pending"
      : remindDate(f) === today && f.status === "pending";
    return q && fl;
  });

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
          ติดตามลูกค้า <span className="text-rose-500">({pending.length} รอ)</span>
        </h2>
        <button onClick={openFollow}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg">
          <Ic d={IC.plus} cls="w-4 h-4"/>
          <span className="hidden sm:inline">เพิ่มงาน</span>
        </button>
      </div>

      {/* Stats */}
      <div className="rounded-2xl p-4 mb-6 border backdrop-blur-md bg-gradient-to-r from-pink-50 via-rose-50 to-fuchsia-50 border-pink-200 shadow-lg shadow-pink-100/50">
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "รอดำเนินการ", n: pending.length,                                 bg: "bg-rose-100/50",    border: "border-rose-300",    text: "text-rose-600"    },
            { l: "แจ้งเตือนวันนี้", n: follows.filter(f => isDueToday(f)).length,  bg: "bg-amber-100/50",   border: "border-amber-300",   text: "text-amber-700"   },
            { l: "เสร็จแล้ว",  n: follows.filter(f => f.status === "done").length, bg: "bg-emerald-100/50", border: "border-emerald-300", text: "text-emerald-700" },
          ].map(s => (
            <div key={s.l} className={`p-3 rounded-xl backdrop-blur-sm border ${s.bg} ${s.border}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.text}`}>{s.l}</p>
              <p className={`text-xl font-bold ${s.text}`}>{s.n}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Ic d={IC.search} cls="w-4 h-4 text-pink-500 absolute left-3.5 top-1/2 -translate-y-1/2"/>
          <input value={followQ} onChange={e => setFollowQ(e.target.value)} placeholder="ค้นหา..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-pink-200 bg-white/90 backdrop-blur-xl shadow-sm text-sm placeholder-pink-300 text-slate-700 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"/>
        </div>
        <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg shadow-pink-100/50 p-2 border border-pink-200 flex gap-1">
          {([{ id: "pending", l: "รอ" }, { id: "today", l: "วันนี้" }, { id: "all", l: "ทั้งหมด" }] as { id: "pending"|"today"|"all"; l: string }[]).map(f => (
            <button key={f.id} onClick={() => setFollowF(f.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-sm ${
                followF === f.id ? "bg-rose-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-8 text-center">
          <Ic d={IC.follow} cls="w-12 h-12 text-pink-600 mx-auto mb-3"/>
          <p className="text-pink-700 font-semibold">ไม่มีรายการ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {filtered.map(f => {
            const fcfg   = F_CFG[f.status];
            const over   = isOverdue(f);
            const dToday = isDueToday(f);
            return (
              <div key={f.task_id}
                className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg p-5 border transition-all hover:shadow-2xl ${
                  over ? "border-red-200 bg-red-50/20" : dToday ? "border-amber-200 bg-amber-50/20" : "border-pink-200 hover:shadow-pink-100 hover:-translate-y-1"
                }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-slate-800">{f.customer_name}</p>
                      <span className="text-xs text-slate-400">{f.customer_id}</span>
                      {over    && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-500">เกินกำหนด</span>}
                      {dToday && !over && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">แจ้งเตือนวันนี้</span>}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
                      <span className="font-semibold text-rose-400">{f.task_type}</span>
                      {f.customer_phone && <span className="flex items-center gap-1">📞 {f.customer_phone}</span>}
                      <span className="flex items-center gap-1"><Ic d={IC.clock} cls="w-3.5 h-3.5"/>นัด {fmtDate(f.due_date)}</span>
                      {f.reminded_at && <span className="flex items-center gap-1 text-blue-500">🔔 {fmtDate(f.reminded_at)}</span>}
                    </div>
                    {f.description && <p className="text-sm text-slate-500 mt-2">{f.description}</p>}
                  </div>
                  <Badge label={fcfg.l} bg={fcfg.bg} text={fcfg.text}/>
                </div>

                {f.status === "pending" && (
                  <div className="flex gap-2 pt-4 border-t border-pink-200">
                    <button onClick={() => updFollowStatus(f, "done")}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm hover:shadow-md transition-all">
                      <Ic d={IC.check} cls="w-3.5 h-3.5"/>เสร็จแล้ว
                    </button>
                    <button onClick={() => updFollowStatus(f, "skipped")}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                      ข้าม
                    </button>
                    <button onClick={() => onEditFollow(f)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-50 hover:bg-pink-100 text-rose-400 border border-pink-200 transition-colors flex-shrink-0">
                      <Ic d={IC.edit} cls="w-4 h-4"/>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}