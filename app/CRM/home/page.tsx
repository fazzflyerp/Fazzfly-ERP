// app/CRM/home/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  type Appointment, type Customer, type Course, type FollowUp, type TabId,
  type CRMConfig, type HelperOption, type FormField,
  APT_API, CUST_API, COURSE_API, FOLLOW_API, HELPER_API, CRM_MODULES_API, CONFIG_API,
  DEFAULT_HELPER_MAP, FALLBACK_OPTIONS,
  genId, toISO, todayStr, makeDStr, getDays, getFirst,
  aptToRow, custToRow, flwToRow,
} from "@/app/components/crm/crm.types";

import { IC } from "@/app/components/crm/crm.ui";
import CRMNavBar from "@/app/components/crm/CRMNavBar";
import QuickNav from "@/app/components/QuickNav";
import CalendarTab from "@/app/components/crm/CalendarTab";
import CustomersTab from "@/app/components/crm/CustomersTab";
import FollowsTab from "@/app/components/crm/FollowsTab";
import { AptModal, CustModal, FlwModal, AptDetailPanel, CustDetailPanel } from "@/app/components/crm/CRMModals";

export default function CRMPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cfg, setCfg] = useState<CRMConfig | null>(null);
  const [aptFields, setAptFields] = useState<FormField[]>([]);
  const [custFields, setCustFields] = useState<FormField[]>([]);
  const [followSid, setFollowSid] = useState("");
  const [custSid, setCustSid] = useState("");
  const [clientId, setClientId] = useState("");
  const [txMod, setTxMod] = useState<{ spreadsheetId: string; sheetName: string; configName?: string } | null>(null);
  const [apts, setApts] = useState<Appointment[]>([]);
  const [custs, setCusts] = useState<Customer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [follows, setFollows] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabId>(() => (searchParams.get("tab") as TabId) || "cal");
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [selDate, setSelDate] = useState(todayStr());

  const [custQ, setCustQ] = useState("");
  const [courseQ, setCourseQ] = useState("");
  const [followQ, setFollowQ] = useState("");
  const [followF, setFollowF] = useState<"all" | "pending" | "today">("pending");

  const [dApt, setDApt] = useState<Appointment | null>(null);
  const [dCust, setDCust] = useState<Customer | null>(null);
  const [mApt, setMApt] = useState(false);
  const [mCust, setMCust] = useState(false);
  const [mFollow, setMFollow] = useState(false);

  const [eApt, setEApt] = useState<Appointment | null>(null);
  const [eCust, setECust] = useState<Customer | null>(null);
  const [eFollow, setEFollow] = useState<FollowUp | null>(null);

  const [sApt, setSApt] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sCust, setSCust] = useState(false);
  const [sFollow, setSFollow] = useState(false);

  const ea0 = (): Partial<Appointment> => ({ customer_id: "", customer_name: "", customer_phone: "", appointment_date: selDate, appointment_time: "10:00", end_time: "11:00", service: "", doctor: "", status: "pending", course_id: "", price: 0, deposit: 0, notes: "" });
  const ec0 = (): Partial<Customer> => ({ customer_id: "", full_name: "", nickname: "", phone_number: "", line_id: "", email: "", gender: "หญิง", birthdate: "", address: "", tax_id: "", allergy: "", medical_history: "", skin_type: "", source: "", member_level: "ทั่วไป", notes: "" });
  const ef0 = (): Partial<FollowUp> => ({ customer_id: "", customer_name: "", customer_phone: "", due_date: todayStr(), task_type: "", description: "", status: "pending", appointment_id: "", notes: "" });

  const [fApt, setFApt] = useState<Partial<Appointment>>(ea0());
  const [fCust, setFCust] = useState<Partial<Customer>>(ec0());
  const [fFollow, setFFollow] = useState<Partial<FollowUp>>(ef0());


  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (status === "authenticated") boot();
  }, [status]);


  // ───────────────────────────────────────────────────────────────────────────
  // boot — pattern เหมือน ERP/form/page.tsx fetchFormConfig()
  //  1) GET /api/user/modules → spreadsheetId + helperMap
  //  2) fetchHelper() ทีละ helperName → helperOptions[helperName] = HelperOption[]
  //  3) load ข้อมูล
  // ───────────────────────────────────────────────────────────────────────────
  const boot = async () => {
    setLoading(true);
    try {
      // 1) ดึง clientId + hasCRM จาก /api/user/modules
      const userRes = await fetch("/api/user/modules");
      if (userRes.status === 401) {
        const { signOut } = await import("next-auth/react");
        await signOut({ callbackUrl: "/login" }); return;
      }
      if (!userRes.ok) throw new Error(`user/modules: ${userRes.status}`);
      const userData = await userRes.json();
      if (!userData.hasCRM) { router.push("/pricing"); return; }

      const clientId: string = userData.clientId;
      setClientId(userData.clientId);

      // 2) ดึง CRM module config จาก client_crm sheet
      const modRes = await fetch(`${CRM_MODULES_API}?clientId=${clientId}`);
      if (!modRes.ok) throw new Error(`crm/modules: ${modRes.status}`);
      const modData = await modRes.json();
      if (!modData.hasCRM) { router.push("/pricing"); return; }

      const spreadsheetId: string = modData.appointments?.spreadsheetId || "";
      const helperMap: CRMConfig["helperMap"] = DEFAULT_HELPER_MAP;

      // 2) fetch helpers — เหมือน ERP form loop แต่ยิง parallel
      //    สังเกต: ใช้ /api/module/helpers?spreadsheetId=xxx&helperName=yyy
      //    response: { options: [{value, label}] }
      const fetchHelper = async (helperName: string): Promise<HelperOption[]> => {
        try {
          const url = new URL(`${window.location.origin}/${HELPER_API}`);
          url.searchParams.set("spreadsheetId", spreadsheetId);
          url.searchParams.set("helperName", helperName);
          const res = await fetch(url.toString());
          if (!res.ok) return [];
          const json = await res.json();
          return (json.options || []) as HelperOption[];
        } catch {
          return [];
        }
      };

      // ยิง parallel ทุก helper พร้อมกัน
      const keys = Object.keys(helperMap) as (keyof typeof helperMap)[];  // รวม customers: Helpers_C
      const results = await Promise.all(keys.map(k => fetchHelper(helperMap[k])));

      // สร้าง helperOptions: { [helperName]: HelperOption[] }
      // เหมือน ERP form: helperOptions[field.helper] || []
      const helperOptions: { [helperName: string]: HelperOption[] } = {};
      keys.forEach((k, i) => {
        const helperName = helperMap[k];
        helperOptions[helperName] = results[i].length > 0
          ? results[i]
          : FALLBACK_OPTIONS[k];  // fallback ถ้า sheet ว่าง
      });

      setCfg({ spreadsheetId, helperMap, helperOptions });

      // 3) ดึง apt config fields จาก Config_appointments sheet
      try {
        const cfgUrl = new URL(`${window.location.origin}/${CONFIG_API}`);
        cfgUrl.searchParams.set("spreadsheetId", spreadsheetId);
        cfgUrl.searchParams.set("configName", modData.appointments?.configName || "Config_appointments");
        const cfgRes = await fetch(cfgUrl.toString());
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          setAptFields(cfgData.fields || []);

          // ดึง helper ใหม่ที่อยู่ใน config แต่ยังไม่มีใน helperOptions
          const newHelpers: { [k: string]: HelperOption[] } = {};
          for (const field of (cfgData.fields || [])) {
            if (field.helper && !helperOptions[field.helper]) {
              try {
                const hUrl = new URL(`${window.location.origin}/${HELPER_API}`);
                hUrl.searchParams.set("spreadsheetId", spreadsheetId);
                hUrl.searchParams.set("helperName", field.helper);
                const hRes = await fetch(hUrl.toString());
                if (hRes.ok) {
                  const hJson = await hRes.json();
                  newHelpers[field.helper] = hJson.options || [];
                }
              } catch { }
            }
          }
          if (Object.keys(newHelpers).length > 0) {
            setCfg(c => c ? { ...c, helperOptions: { ...c.helperOptions, ...newHelpers } } : c);
          }
        }
      } catch (e) { console.warn("config fetch:", e); }

      setFollowSid(modData.followup?.spreadsheetId || spreadsheetId);

      if (modData.transaction?.spreadsheetId) {
        setTxMod({ spreadsheetId: modData.transaction.spreadsheetId, sheetName: modData.transaction.sheetName || "Sales Transactions", configName: modData.transaction.configName || "Sales_Config" });
      }

      // โหลด Customers_config
      if (modData.Master?.spreadsheetId && modData.Master?.configName) {
        try {
          const custCfgRes = await fetch(`/api/module/config?spreadsheetId=${modData.Master.spreadsheetId}&configName=${modData.Master.configName}`);
          const custCfgData = await custCfgRes.json();
          setCustFields(custCfgData.fields || []);
        } catch { }
      }

      // 4) load ข้อมูล — แต่ละ module ใช้ spreadsheetId ของตัวเอง
      await Promise.all([
        fApts(modData.appointments?.spreadsheetId),
        fCusts(modData.Master?.spreadsheetId, modData.Master?.sheetName),
        fCourses(modData.courses?.spreadsheetId),
        fFollows(modData.followup?.spreadsheetId),
      ]);
    } catch (e) {
      console.error("CRM boot:", e);
    } finally {
      setLoading(false);
    }
  };

  const sid = () => cfg?.spreadsheetId ?? "";
  const fApts = async (id?: string) => { if (!id) return; try { const r = await fetch(`${APT_API}?spreadsheetId=${id}`); const d = await r.json(); setApts(d.appointments || []); } catch { } };
  const CUST_SHEET_ID = "13mWybZoA3t9EhEa3MCb_WVEbZrU_TiIbVZfd-CDerZ0";
  const fCusts = async (sid?: string, sname?: string) => {
    try {
      if (!sid) return;
      const r = await fetch(`${CUST_API}?spreadsheetId=${sid}&sheetName=${sname || "Customers"}`);
      const d = await r.json();
      setCusts(d.customers || []);
      setCustSid(sid);
    } catch { }
  };
  const fCourses = async (id?: string) => { if (!id) return; try { const r = await fetch(`${COURSE_API}?spreadsheetId=${id}`); const d = await r.json(); setCourses(d.courses || []); } catch { } };
  const fFollows = async (id?: string) => { if (!id) return; try { const r = await fetch(`${FOLLOW_API}?spreadsheetId=${id}`); const d = await r.json(); setFollows(d.tasks || []); } catch { } };

  const saveApt = async () => {
    if (!cfg) return;
    if (!fApt.customer_name || !fApt.appointment_date || !fApt.service || !fApt.doctor) { alert("กรุณากรอกข้อมูลที่จำเป็น"); return; }
    setSApt(true);
    try {
      const isEdit = !!eApt;
      const obj = { ...ea0(), ...fApt, appointment_id: eApt?.appointment_id || genId("APT"), created_at: eApt?.created_at || toISO(), created_by: (session as any)?.user?.email || "", reminded_at: eApt?.reminded_at || "", course_id: fApt.course_id || "" } as Appointment;
      // optimistic update — แสดงทันทีก่อน fetch
      if (isEdit) {
        setApts(prev => prev.map(a => a.appointment_id === obj.appointment_id ? { ...obj, rowIndex: eApt!.rowIndex } : a));
      } else {
        setApts(prev => [{ ...obj, rowIndex: 9999 }, ...prev]);
      }
      closeMApt();
      fetch(APT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.spreadsheetId, sheetName: "appointments", action: isEdit ? "update" : "append", row: aptToRow(obj), ...(isEdit && { rowIndex: eApt?.rowIndex }) }) })
        .then(() => fApts(cfg.spreadsheetId));
    } catch (e: any) { alert(e.message); } finally { setSApt(false); }
  };

  const updAptStatus = async (apt: Appointment, s: Appointment["status"]) => {
    if (!cfg) return;
    // optimistic update
    setApts(prev => prev.map(a => a.appointment_id === apt.appointment_id ? { ...a, status: s } : a));
    setDApt({ ...apt, status: s });
    fetch(APT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: cfg.spreadsheetId, sheetName: "appointments", action: "status", rowIndex: apt.rowIndex, status: s }) })
      .then(() => fApts(cfg.spreadsheetId));
  };

  const saveCust = async () => {
    if (!cfg) return;
    if (!fCust.full_name || !fCust.phone_number) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    setSCust(true);
    try {
      const isEdit = !!eCust;
      const obj = { ...ec0(), ...fCust, customer_id: eCust?.customer_id || genId("CUS") } as Customer;
      await fetch(CUST_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: custSid, sheetName: "Customers", action: isEdit ? "update" : "append", row: custToRow(obj), ...(isEdit && { rowIndex: eCust?.rowIndex }) }) });
      await fCusts(); closeMCust();
    } catch (e: any) { alert(e.message); } finally { setSCust(false); }
  };

  const saveFollow = async () => {
    if (!cfg) return;
    if (!fFollow.customer_name || !fFollow.due_date || !fFollow.task_type) { alert("กรุณากรอกข้อมูลที่จำเป็น"); return; }
    setSFollow(true);
    try {
      const isEdit = !!eFollow;
      const obj = { ...ef0(), ...fFollow, task_id: eFollow?.task_id || genId("FLW"), created_at: eFollow?.created_at || toISO(), created_by: (session as any)?.user?.email || "" } as FollowUp;
      if (isEdit) {
        setFollows(prev => prev.map(f => f.task_id === obj.task_id ? { ...obj, rowIndex: eFollow!.rowIndex } : f));
      } else {
        setFollows(prev => [{ ...obj, rowIndex: 9999 }, ...prev]);
      }
      closeMFollow();
      fetch(FOLLOW_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: followSid || cfg.spreadsheetId, sheetName: "followup_tasks", action: isEdit ? "update" : "append", row: flwToRow(obj), ...(isEdit && { rowIndex: eFollow?.rowIndex }) }) })
        .then(() => fFollows(followSid));
    } catch (e: any) { alert(e.message); } finally { setSFollow(false); }
  };

  const updFollowStatus = async (f: FollowUp, s: FollowUp["status"]) => {
    if (!cfg) return;
    setFollows(prev => prev.map(t => t.task_id === f.task_id ? { ...t, status: s } : t));
    fetch(FOLLOW_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: followSid || cfg.spreadsheetId, sheetName: "followup_tasks", action: "status", rowIndex: f.rowIndex, status: s }) })
      .then(() => fFollows(followSid));
  };

  const closeMApt = () => { setMApt(false); setEApt(null); setFApt(ea0()); };
  const closeMCust = () => { setMCust(false); setECust(null); setFCust(ec0()); };
  const closeMFollow = () => { setMFollow(false); setEFollow(null); setFFollow(ef0()); };

  const openApt = async (date?: string, pre?: Partial<Appointment>) => {
    setEApt(null);
    setFApt({ ...ea0(), appointment_date: date || selDate, ...pre });
    setMApt(true); // เปิด modal ทันที ไม่รอ fetch

    // ✅ Re-fetch Helpers_C realtime
    if (cfg) {
      try {
        const url = new URL(`${window.location.origin}/${HELPER_API}`);
        url.searchParams.set("spreadsheetId", cfg.spreadsheetId);
        url.searchParams.set("helperName", cfg.helperMap.customers);
        url.searchParams.set("bust", Date.now().toString()); // bypass CDN cache
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const fresh: HelperOption[] = json.options || [];
          if (fresh.length > 0) {
            setCfg(c => c ? {
              ...c,
              helperOptions: { ...c.helperOptions, [cfg.helperMap.customers]: fresh }
            } : c);
          }
        }
      } catch { }
    }
  };
  const editApt = (a: Appointment) => { setEApt(a); setFApt({ ...a }); setMApt(true); };
  const openCust = () => { setECust(null); setFCust(ec0()); setMCust(true); };
  const editCust = (c: Customer) => { setECust(c); setFCust({ ...c }); setMCust(true); };
  const openFollow = (c?: Customer) => {
    setEFollow(null);
    setFFollow({ ...ef0(), ...(c ? { customer_id: c.customer_id, customer_name: c.full_name, customer_phone: c.phone_number } : {}) });
    setMFollow(true);
  };

  const selApts = apts.filter(a => a.appointment_date === selDate).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const cntDate = (d: string) => apts.filter(a => a.appointment_date === d).length;
  const calDays = [...Array(getFirst(calY, calM)).fill(0), ...Array.from({ length: getDays(calY, calM) }, (_, i) => i + 1)];
  const isTodayC = (d: number) => now.getFullYear() === calY && now.getMonth() === calM && now.getDate() === d;
  const isSelC = (d: number) => makeDStr(calY, calM, d) === selDate;
  const pending = follows.filter(f => f.status === "pending");

  const TABS = [
    { id: "cal" as TabId, icon: IC.cal, label: "ปฏิทิน", badge: selApts.length },
    { id: "custs" as TabId, icon: IC.users, label: "ลูกค้า", badge: 0 },
    { id: "follows" as TabId, icon: IC.follow, label: "ติดตาม", badge: pending.length },
  ];

  if (status === "loading" || loading || !cfg) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif", background: "linear-gradient(135deg,#fdf2f8,#fce7f3,#fdf4ff)" }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4" />
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 lg:pb-0"
      style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif", background: "linear-gradient(135deg,#fdf2f8 0%,#fce7f3 40%,#fdf4ff 100%)" }}>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 lg:w-96 h-80 lg:h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 lg:w-96 h-80 lg:h-96 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 lg:w-96 h-80 lg:h-96 bg-fuchsia-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />
      <CRMNavBar userName={(session as any)?.user?.name} pendingCount={pending.length} follows={follows} onFollowClick={() => setTab("follows")} onOpenQuickNav={() => setNavOpen(true)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-12">
        <div className="mb-6 lg:mb-10">
          <h1 className="text-3xl lg:text-5xl font-bold text-slate-800 mb-2">
            ยินดีต้อนรับ, <span className="text-rose-500">{(session as any)?.user?.name || "ผู้ใช้"}</span>
          </h1>
          <p className="text-base lg:text-lg text-slate-600">จัดการนัดหมาย ลูกค้า คอร์ส และติดตามผล</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:gap-6 mb-6 lg:mb-10">
          <div className="p-4 lg:p-6 rounded-2xl lg:rounded-3xl bg-white/90 backdrop-blur-md border border-pink-200 shadow-lg shadow-pink-100/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">นัดหมายวันนี้</p>
            <p className="text-3xl lg:text-4xl font-bold text-slate-800">{selApts.length}</p>
            <p className="text-xs text-slate-700 font-medium mt-1">รายการ</p>
          </div>
          <div className="p-4 lg:p-6 rounded-2xl lg:rounded-3xl bg-white/90 backdrop-blur-md border border-pink-200 shadow-lg shadow-pink-100/50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ลูกค้าทั้งหมด</p>
            <p className="text-3xl lg:text-4xl font-bold text-slate-900">{custs.length}</p>
            <p className="text-xs text-slate-700 font-medium mt-1">คน</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 lg:mb-8 overflow-x-auto scrollbar-hide bg-white/50 backdrop-blur-md rounded-xl lg:rounded-2xl p-2 border border-pink-200">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 lg:px-6 py-2.5 lg:py-3 font-semibold transition-all relative whitespace-nowrap text-sm lg:text-base ${tab === t.id ? "text-pink-600 font-bold" : "text-slate-600 hover:text-slate-800"}`}>
              <span className="flex items-center gap-1 lg:gap-2">
                <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
                {t.label}
                {t.badge > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${tab === t.id ? "bg-pink-100 text-pink-600" : "bg-slate-100 text-slate-500"}`}>{t.badge}</span>}
              </span>
              {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-pink-500 rounded-full" />}
            </button>
          ))}
        </div>

        {tab === "cal" && <CalendarTab apts={apts} calY={calY} calM={calM} calDays={calDays} selDate={selDate} selApts={selApts} setSelDate={setSelDate} setCalY={setCalY} setCalM={setCalM} cntDate={cntDate} isTodayC={isTodayC} isSelC={isSelC} openApt={openApt} setDApt={setDApt} />}
        {tab === "custs" && <CustomersTab customers={custs} courses={courses} follows={follows} custQ={custQ} setCustQ={setCustQ} config={cfg} openCust={openCust} setDCust={setDCust} />}
        {tab === "follows" && <FollowsTab follows={follows} followQ={followQ} setFollowQ={setFollowQ} followF={followF} setFollowF={setFollowF} openFollow={() => openFollow()} updFollowStatus={updFollowStatus} onEditFollow={f => { setEFollow(f); setFFollow({ ...f }); setMFollow(true); }} />}
      </div>

      <AptModal open={mApt} onClose={closeMApt} isEdit={!!eApt} loading={sApt} form={fApt} setForm={setFApt} customers={custs} config={cfg} fields={aptFields} onSave={saveApt} />
      <CustModal open={mCust} onClose={closeMCust} isEdit={!!eCust} loading={sCust} form={fCust} setForm={setFCust} config={cfg} fields={custFields} onSave={saveCust} />
      <FlwModal open={mFollow} onClose={closeMFollow} isEdit={!!eFollow} loading={sFollow} form={fFollow} setForm={setFFollow} customers={custs} config={cfg} onSave={saveFollow} />
      <AptDetailPanel apt={dApt} onClose={() => setDApt(null)} onEdit={editApt} onViewProfile={a => { const c = custs.find(x => x.customer_id === a.customer_id); setDApt(null); if (c) { setDCust(c); setTab("custs"); } }} updAptStatus={updAptStatus} />
      <CustDetailPanel cust={dCust} onClose={() => setDCust(null)} onEdit={editCust} onFollow={openFollow} courses={courses} apts={apts} clientId={clientId} txMod={txMod} onBookApt={c => { openApt(undefined, { customer_id: c.customer_id, customer_name: c.full_name, customer_phone: c.phone_number }); setTab("cal"); }} />

      <style jsx>{`
        @keyframes blob { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-50px) scale(1.1)} 66%{transform:translate(-20px,20px) scale(0.9)} }
        .animate-blob{animation:blob 7s infinite} .animation-delay-2000{animation-delay:2s} .animation-delay-4000{animation-delay:4s}
        .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none} .scrollbar-hide::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}