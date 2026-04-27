// app/components/crm/CustomersTab.tsx
"use client";
import { Ic, IC } from "@/app/components/crm/crm.ui";
import { MEMBER_CFG } from "@/app/components/crm/crm.types";
import type { Customer, Course, FollowUp, CRMConfig } from "@/app/components/crm/crm.types";

interface Props {
  customers: Customer[];
  courses: Course[];
  follows: FollowUp[];
  custQ: string;
  setCustQ: (q: string) => void;
  config: CRMConfig;
  openCust: () => void;
  setDCust: (c: Customer) => void;
}

export default function CustomersTab({ customers, courses, follows, custQ, setCustQ, config, openCust, setDCust }: Props) {
  // DEBUG: log customer IDs to see actual format
  console.log("[CRM] customers sample:", customers.slice(0, 3).map(c => ({ id: c.customer_id, name: c.full_name })));

  const q = custQ.toLowerCase().trim();
  const filtered = q === "" ? customers : customers.filter(c =>
    [c.full_name, c.nickname, c.customer_id].some(
      field => (field || "").toLowerCase().trim().includes(q)
    )
  );

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4 lg:mb-8">
        <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">
          ลูกค้า <span className="text-pink-500">({filtered.length})</span>
        </h2>
        <button onClick={openCust}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg">
          <Ic d={IC.plus} cls="w-4 h-4"/>
          <span className="hidden sm:inline">เพิ่มลูกค้า</span>
        </button>
      </div>

      <div className="relative mb-6">
        <Ic d={IC.search} cls="w-4 h-4 text-pink-500 absolute left-3.5 top-1/2 -translate-y-1/2"/>
        <input value={custQ} onChange={e => setCustQ(e.target.value)} placeholder="ค้นหารหัสลูกค้า, ชื่อ, ชื่อเล่น..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-pink-200 bg-white/90 backdrop-blur-xl shadow-sm text-sm placeholder-pink-300 text-slate-700 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition-all"/>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-8 text-center">
          <Ic d={IC.users} cls="w-12 h-12 text-pink-600 mx-auto mb-3"/>
          <p className="text-pink-700 font-semibold">ไม่พบลูกค้า</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filtered.map(c => {
            const ml  = c.member_level || "ทั่วไป";
            const mcf = MEMBER_CFG[ml] || MEMBER_CFG["ทั่วไป"];
            const act = courses.filter(co => co.customer_id === c.customer_id && co.status === "active");
            const pfl = follows.filter(f => f.customer_id === c.customer_id && f.status === "pending");
            return (
              <button key={c.customer_id} onClick={() => setDCust(c)}
                className="text-left bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-pink-50 p-5 border border-pink-200 hover:shadow-2xl hover:shadow-pink-100 hover:-translate-y-2 transition-all duration-300 group h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono font-semibold text-pink-400 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-100">
                    {c.customer_id || "—"}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${mcf.bg} ${mcf.text} ${mcf.border}`}>{ml}</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${mcf.grad} text-white text-base font-bold group-hover:scale-110 transition-transform flex-shrink-0`}>
                    {c.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-800 group-hover:text-rose-500 transition-colors truncate">{c.full_name}</h3>
                    {c.nickname && <p className="text-xs text-slate-500 truncate">({c.nickname})</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-2">
                  <Ic d={IC.phone} cls="w-3.5 h-3.5 text-pink-500"/>
                  {c.phone_number || "—"}
                  {pfl.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-500">ติดตาม {pfl.length}</span>
                  )}
                </div>

                {c.allergy && (
                  <div className="flex items-center gap-1.5 text-xs rounded-xl px-2.5 py-1.5 mb-3 bg-amber-50 border border-amber-100 text-amber-700">
                    <Ic d={IC.warn} cls="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>
                    แพ้: {c.allergy}
                  </div>
                )}

                {act.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-3 border-t border-pink-200">
                    {act.slice(0, 2).map(co => (
                      <span key={co.course_id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3" }}>
                        {co.course_name} ·{co.remaining_sessions}x
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}