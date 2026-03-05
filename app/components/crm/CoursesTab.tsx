// app/components/crm/CoursesTab.tsx
"use client";
import { Ic, IC } from "@/app/components/crm/crm.ui";
import { MEMBER_CFG, fmtDate, getFieldOptions } from "@/app/components/crm/crm.types";
import type { Customer, Course, CRMConfig } from "@/app/components/crm/crm.types";

interface Props {
  courses: Course[];
  customers: Customer[];
  courseQ: string;
  setCourseQ: (q: string) => void;
  config: CRMConfig;
}

export default function CoursesTab({ courses, customers, courseQ, setCourseQ, config }: Props) {
  const filtered = courses.filter(c =>
    `${c.customer_name}${c.course_name}`.toLowerCase().includes(courseQ.toLowerCase())
  );
  const mCnt = (lvl: string) => customers.filter(c => (c.member_level || "ทั่วไป") === lvl).length;

  return (
    <div className="animate-fadeIn">
      <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4 lg:mb-8">
        คอร์ส & สมาชิก <span className="text-pink-500">({filtered.length})</span>
      </h2>

      {/* Member stats */}
      <div className="rounded-2xl p-4 mb-6 border backdrop-blur-md bg-gradient-to-r from-pink-50 via-rose-50 to-fuchsia-50 border-pink-200 shadow-lg shadow-pink-100/50">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {getFieldOptions(config, 'members').map(lvl => {
            const mcf = MEMBER_CFG[lvl] || MEMBER_CFG["ทั่วไป"];
            return (
              <div key={lvl} className={`p-3 rounded-xl backdrop-blur-sm border ${mcf.bg} ${mcf.border}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${mcf.text}`}>{lvl}</p>
                <p className={`text-xl font-bold ${mcf.text}`}>{mCnt(lvl)}</p>
                <p className={`text-xs mt-1 ${mcf.text} opacity-60`}>คน</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mb-5">
        <Ic d={IC.search} cls="w-4 h-4 text-pink-500 absolute left-3.5 top-1/2 -translate-y-1/2"/>
        <input value={courseQ} onChange={e => setCourseQ(e.target.value)} placeholder="ค้นหาชื่อลูกค้า หรือคอร์ส..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-pink-200 bg-white/90 backdrop-blur-xl shadow-sm text-sm placeholder-pink-300 text-slate-700 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"/>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-8 text-center">
          <p className="text-pink-700 font-semibold">ไม่พบคอร์ส</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {filtered.map(co => {
            const pct = co.total_sessions > 0 ? (co.used_sessions / co.total_sessions) * 100 : 0;
            const exp = co.expire_date && new Date(co.expire_date) < new Date(Date.now() + 7 * 864e5);
            return (
              <div key={co.course_id}
                className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-pink-50 p-5 border border-pink-200 hover:shadow-2xl hover:shadow-pink-100 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-800">{co.customer_name}</p>
                      {exp && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">⚠ ใกล้หมด</span>}
                    </div>
                    <p className="text-sm font-semibold text-rose-400">{co.course_name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    co.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : co.status === "completed" ? "bg-slate-100 text-slate-500"
                      : "bg-red-50 text-red-500"
                  }`}>
                    {co.status === "active" ? "ใช้งาน" : co.status === "completed" ? "ครบแล้ว" : "หมดอายุ"}
                  </span>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="h-2 bg-pink-50 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#10b981" : "linear-gradient(90deg,#f43f5e,#ec4899)" }}/>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{co.used_sessions}/{co.total_sessions} ครั้ง</span>
                    <span className="font-semibold text-rose-500">เหลือ {co.remaining_sessions} ครั้ง</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                    <span>หมด {fmtDate(co.expire_date)}</span>
                    {co.total_price > 0 && <span className="font-semibold text-slate-600">฿{co.total_price.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}