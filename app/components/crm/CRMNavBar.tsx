// app/components/crm/CRMNavBar.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Ic, IC } from "@/app/components/crm/crm.ui";
import { fmtDate, todayStr } from "@/app/components/crm/crm.types";
import type { FollowUp } from "@/app/components/crm/crm.types";

interface Props {
  userName?: string;
  pendingCount: number;
  follows: FollowUp[];
  onFollowClick: () => void;
}

export default function CRMNavBar({ userName, pendingCount, follows, onFollowClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = todayStr();

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // tasks ที่ due วันนี้หรือเกินกำหนด
  // แสดงใน bell ถ้า due_date วันนี้หรือเกินกำหนด
  // แสดงใน bell เฉพาะ reminded_at = วันนี้ และยังไม่เสร็จ
  const urgent = follows.filter(f => f.status === "pending" && f.reminded_at === today);
  const count  = urgent.length;

  return (
    <nav className="relative z-20 bg-white/80 backdrop-blur-xl border-b border-pink-200 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">

        <div className="flex items-center gap-2 lg:gap-4 min-w-0">
          <Link href="/select-system"
            className="flex items-center gap-2 px-3 py-2 bg-pink-50 hover:bg-pink-100 border border-pink-200 hover:border-pink-300 rounded-xl transition-all duration-300 group shadow-sm hover:shadow-md flex-shrink-0">
            <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors hidden sm:inline">ย้อนกลับ</span>
          </Link>

          <div className="w-8 lg:w-10 h-8 lg:h-10 flex items-center justify-center flex-shrink-0">
            <Image src="/logo2.png" alt="Fazzfly Logo" width={40} height={40} className="object-contain"/>
          </div>

          <div className="hidden md:block">
            <span className="text-lg lg:text-xl font-bold text-rose-600">Fazzfly CRM</span>
            <p className="text-xs text-slate-500">ระบบดูแลลูกค้าคลินิก</p>
          </div>
          <span className="text-base font-bold text-rose-600 md:hidden">Fazzfly CRM</span>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 ml-auto">

          {/* 🔔 กระดิ่งแจ้งเตือน */}
          <div className="relative" ref={ref}>
            <button onClick={() => setOpen(o => !o)}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-pink-50 hover:bg-pink-100 border border-pink-200 hover:border-pink-300 transition-all">
              {/* bell icon */}
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl shadow-pink-100 border border-pink-200 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-pink-100 flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-sm">แจ้งเตือนงานติดตาม</p>
                  {count > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">{count} รายการ</span>}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {urgent.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">ไม่มีงานที่ต้องติดตาม 🎉</div>
                  ) : (
                    urgent.map(f => {
                      const overdue = f.due_date < today;
                      return (
                        <button key={f.task_id}
                          onClick={() => { setOpen(false); onFollowClick(); }}
                          className="w-full text-left px-4 py-3 hover:bg-pink-50 border-b border-pink-50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{f.customer_name}</p>
                              <p className="text-xs text-slate-500 truncate">{f.task_type}{f.description ? ` — ${f.description}` : ""}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${overdue ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-600"}`}>
                              {overdue ? "เลยกำหนด" : "แจ้งเตือน"}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${overdue ? "text-red-400" : "text-blue-400"}`}>
                            นัด {fmtDate(f.due_date)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-pink-100">
                  <button onClick={() => { setOpen(false); onFollowClick(); }}
                    className="w-full text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors text-center">
                    ดูทั้งหมด →
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-600">สวัสดี</p>
            <p className="font-semibold text-slate-800 text-sm truncate max-w-[120px] lg:max-w-none">{userName}</p>
          </div>

          <button onClick={() => signOut({ callbackUrl: "/" })}
            className="px-3 lg:px-4 py-2 text-xs lg:text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium whitespace-nowrap flex-shrink-0 border border-red-200 hover:border-red-300">
            <span className="hidden sm:inline">ออกจากระบบ</span>
            <span className="sm:hidden">ออก</span>
          </button>
        </div>
      </div>
    </nav>
  );
}