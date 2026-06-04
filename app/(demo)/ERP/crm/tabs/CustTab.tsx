"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Customer, Course, Appointment } from "@/app/components/crm/crm.types";
import { fmtDate, MEMBER_CFG } from "@/app/components/crm/crm.types";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TxRecord {
  rowIndex:        number;
  date:            string;
  program_status:  string;
  program:         string;
  quantity:        number;
  price:           number;
  doctor:          string;
  staff:           string;
  usedCourse:      boolean;
  branch_name:     string;
  member_payment:  number;   // col 36 — "ใช้ Member" (payment_10)
}

interface DriveFolder { id: string; name: string }
interface DriveImage  { id: string; name: string; mimeType: string; thumbnailLink: string | null; webViewLink: string | null; createdTime: string | null; size: string | null }

interface Props {
  customers:        Customer[];
  courses:          Course[];
  apts:             Appointment[];
  branchId:         string;
  isSuperAdmin:     boolean;
  allBranches:      { branchId: string; branchName: string }[];
  onOpenCust:       () => void;
  onEditCust:       (c: Customer) => void;
  onTransfer:       (c: Customer, newBranchId: string, newBranchName: string) => void;
  txMod:            { spreadsheetId: string; sheetName: string; configName?: string } | null;
  clientId:         string;
  activeBranchName: string;
  onOpenFollow:     (c: Customer) => void;
  onOpenApt:        (c: Customer) => void;
}

// ── Shared helpers (module-level — used by panel + modals) ────────────────────
const isAddAction    = (s: string) => /เปิด|ซื้อ|ชื้อ|add|buy|open|เพิ่ม|รับโอน/i.test(s);
const isDeductAction = (s: string) => /ตัด|ใช้|cut|use|deduct|หัก|คืน|(?<!รับ)โอน/i.test(s);
/** row ที่เป็นการเติม Member (program_status) */
const isMemberAdd    = (tx: TxRecord) => /เปิด.{0,5}member|member.{0,5}เปิด/i.test((tx.program + " " + tx.program_status).toLowerCase());
/** row ที่ใช้ Member จ่าย — ตรวจจาก col 36 (payment_10 / "ใช้ Member") */
const isMemberUsage  = (tx: TxRecord) => tx.member_payment > 0;
/** row ที่เกี่ยวกับ Member (ใดๆ) — ใช้กันไม่ให้นับเป็น course */
const isMemberTx     = (tx: TxRecord) => isMemberAdd(tx);

/** ราคาเฉลี่ยต่อครั้ง = weighted avg ของ add-type rows ที่มี price > 0 (กันรับโอนที่ price=0 ทำให้ค่าเฉลี่ยต่ำ) */
function calcPricePerSession(
  prog: string,
  courseData: Record<string, { bought: number; used: number; history: TxRecord[] }>
): number {
  const data = courseData[prog];
  if (!data || !data.history.length) return 0;
  const addTxs    = data.history.filter(tx => isAddAction(tx.program_status) && tx.price > 0);
  const totalQty  = addTxs.reduce((s, tx) => s + tx.quantity, 0);
  const totalPaid = addTxs.reduce((s, tx) => s + tx.price,    0);
  return totalQty > 0 ? Math.round(totalPaid / totalQty) : 0;
}

function todayISO(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── APT status config ─────────────────────────────────────────────────────────
const APT_S_CFG: Record<string,{l:string;bg:string;text:string}> = {
  pending:      {l:"รอยืนยัน",  bg:"bg-amber-500/15",   text:"text-amber-400"},
  confirmed:    {l:"ยืนยัน",    bg:"bg-blue-500/15",    text:"text-blue-400"},
  "in-progress":{l:"กำลังทำ",  bg:"bg-violet-500/15",  text:"text-violet-400"},
  done:         {l:"เสร็จ",     bg:"bg-emerald-500/15", text:"text-emerald-400"},
  cancelled:    {l:"ยกเลิก",   bg:"bg-red-500/15",     text:"text-red-400"},
  "no-show":    {l:"ไม่มา",    bg:"bg-slate-500/15",   text:"text-slate-400"},
};

const monthNames: Record<string,string> = {
  "01":"มกราคม","02":"กุมภาพันธ์","03":"มีนาคม","04":"เมษายน",
  "05":"พฤษภาคม","06":"มิถุนายน","07":"กรกฎาคม","08":"สิงหาคม",
  "09":"กันยายน","10":"ตุลาคม","11":"พฤศจิกายน","12":"ธันวาคม",
};

const DETAIL_TABS = [
  { id: "info",      label: "ข้อมูล" },
  { id: "treatment", label: "ประวัติรักษา" },
  { id: "course",    label: "คอร์ส / Member" },
  { id: "photo",     label: "รูปภาพ" },
];

// ── Shared field style ────────────────────────────────────────────────────────
const F_INPUT = "w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500/50 placeholder:text-slate-600";
const F_LABEL = "text-xs font-semibold text-slate-400 mb-1 block";

// ══════════════════════════════════════════════════════════════════════════════
// ── Return Modal (คืนคอร์ส / คืน Member) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ReturnModal({
  initType, initProg, courseMap, memberBalance, txMod,
  cust, activeBranchName, onClose, onSuccess,
}: {
  initType:        "course" | "member";
  initProg:        string;
  courseMap:       Record<string, { bought: number; used: number; history: TxRecord[] }>;
  memberBalance:   number;
  txMod:           { spreadsheetId: string; sheetName: string; configName?: string } | null;
  cust:            Customer;
  activeBranchName: string;
  onClose:         () => void;
  onSuccess:       () => void;
}) {
  const [type,      setType]      = useState<"course"|"member">(initType);
  const [prog,      setProg]      = useState(initProg);
  const [qty,       setQty]       = useState(1);
  const [memberAmt, setMemberAmt] = useState(() => Math.max(0, memberBalance));
  const [fee,       setFee]       = useState(0);
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const availableCourses = Object.entries(courseMap)
    .filter(([, d]) => d.bought - d.used > 0)
    .map(([name]) => name);

  const remaining = prog && courseMap[prog] ? courseMap[prog].bought - courseMap[prog].used : 0;
  const pps       = useMemo(() => calcPricePerSession(prog, courseMap), [prog, courseMap]);
  const gross     = type === "course" ? pps * qty : memberAmt;
  const feeAmt    = Math.round(gross * fee / 100);
  const netRefund = gross - feeAmt;

  const handleSubmit = async () => {
    setErr("");
    if (!txMod) { setErr("ไม่มีข้อมูล Sales Transactions — กรุณาตั้งค่า"); return; }
    if (type === "course") {
      if (!prog)              { setErr("กรุณาเลือกคอร์ส"); return; }
      if (qty < 1 || qty > remaining) { setErr(`จำนวนต้องอยู่ระหว่าง 1–${remaining} ครั้ง`); return; }
    } else {
      if (memberAmt <= 0)        { setErr("กรุณาระบุยอดที่ต้องการคืน"); return; }
      if (memberAmt > memberBalance) { setErr(`ยอดคืนเกิน Member Balance ที่มีอยู่ (฿${memberBalance.toLocaleString()})`); return; }
    }

    setSaving(true);
    try {
      const today = todayISO();
      const noteText = type === "course"
        ? `คืนเงินสด ฿${netRefund.toLocaleString()} (${qty} ครั้ง × ฿${pps.toLocaleString()}${fee > 0 ? ` หักค่าดำเนินการ ${fee}% = ฿${feeAmt.toLocaleString()}` : ""})${notes ? ` — ${notes}` : ""}`
        : `คืนเงินสด ฿${netRefund.toLocaleString()}${fee > 0 ? ` (หักค่าดำเนินการ ${fee}% = ฿${feeAmt.toLocaleString()})` : ""}${notes ? ` — ${notes}` : ""}`;

      const entry = type === "course"
        ? { customerId: cust.customer_id, customerName: cust.full_name, date: today,
            programStatus: "คืนคอร์ส", program: prog,
            quantity: qty, price: -netRefund,
            notes: noteText, branchName: activeBranchName }
        : { customerId: cust.customer_id, customerName: cust.full_name, date: today,
            programStatus: "ตัด Member (คืนเงิน)", program: "Member",
            quantity: 1, price: memberAmt,
            memberPayment: memberAmt,  // col 36 — ให้ balance calculation หักได้
            notes: noteText, branchName: activeBranchName };

      const res = await fetch("/api/crm-demo/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: txMod.spreadsheetId, sheetName: txMod.sheetName, configName: txMod.configName || "Sales_Config", entries: [entry] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      onSuccess();
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">คืนคอร์ส / Member</p>
              <p className="text-slate-500 text-[11px]">{cust.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1.5 bg-white/[0.04] rounded-xl p-1">
            {(["course","member"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${type === t ? "bg-amber-500 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>
                {t === "course" ? "↩ คืนคอร์ส" : "↩ คืน Member"}
              </button>
            ))}
          </div>

          {/* Course selector */}
          {type === "course" && (
            <div className="space-y-3">
              <div>
                <label className={F_LABEL}>เลือกคอร์ส *</label>
                <select value={prog} onChange={e => { setProg(e.target.value); setQty(1); }}
                  className={F_INPUT + " appearance-none"}>
                  <option value="">— เลือกคอร์สที่ต้องการคืน —</option>
                  {availableCourses.map(c => (
                    <option key={c} value={c}>{c} (เหลือ {courseMap[c].bought - courseMap[c].used} ครั้ง)</option>
                  ))}
                </select>
                {availableCourses.length === 0 && <p className="text-amber-400 text-[11px] mt-1">ไม่มีคอร์สที่มีเซสชั่นเหลือ</p>}
              </div>

              {prog && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={F_LABEL}>จำนวนครั้งที่คืน *</label>
                    <input type="number" min={1} max={remaining} value={qty}
                      onChange={e => setQty(Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                      className={F_INPUT} />
                    <p className="text-slate-600 text-[10px] mt-0.5">สูงสุด {remaining} ครั้ง</p>
                  </div>
                  <div>
                    <label className={F_LABEL}>ราคาต่อครั้ง (เฉลี่ย)</label>
                    <div className={F_INPUT + " text-slate-400 flex items-center cursor-default"}>
                      {pps > 0 ? `฿${pps.toLocaleString()}` : "ไม่ทราบราคา"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Member amount */}
          {type === "member" && (
            <div>
              <label className={F_LABEL}>ยอดที่ต้องการคืน *</label>
              <input type="number" min={1} max={memberBalance} value={memberAmt}
                onChange={e => setMemberAmt(Math.min(memberBalance, Math.max(0, parseFloat(e.target.value) || 0)))}
                className={F_INPUT} />
              <p className="text-slate-600 text-[10px] mt-0.5">Member Balance ปัจจุบัน ฿{memberBalance.toLocaleString()}</p>
            </div>
          )}

          {/* Fee */}
          <div>
            <label className={F_LABEL}>หักค่าดำเนินการ (%)</label>
            <input type="number" min={0} max={100} step={0.5} value={fee}
              onChange={e => setFee(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              placeholder="0 = ไม่หัก"
              className={F_INPUT} />
          </div>

          {/* Summary box */}
          {(type === "member" || (type === "course" && prog)) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
              <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-widest">สรุปการคืน</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{type === "course" ? `${qty} ครั้ง × ฿${pps.toLocaleString()}` : "ยอด Member ที่คืน"}</span>
                  <span className="text-white font-semibold">฿{gross.toLocaleString()}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">หักค่าดำเนินการ {fee}%</span>
                    <span className="text-red-400">− ฿{feeAmt.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-amber-500/20">
                  <span className="text-amber-400">คืนเงินสดให้ลูกค้า</span>
                  <span className="text-amber-400">฿{netRefund.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[10px] text-amber-600/80 flex items-start gap-1 pt-0.5">
                <svg className="w-3 h-3 flex-shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                บันทึกเป็นรายจ่าย (Refund) ใน Sales Transactions — หักออกจากรายรับคลีนิก
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={F_LABEL}>หมายเหตุ</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="เหตุผลที่คืน (ไม่บังคับ)..."
              className={F_INPUT} />
          </div>

          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.07]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={saving || (!prog && type==="course") || (type==="member" && memberAmt <= 0)}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : "ยืนยันคืน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Transfer Modal (โอนคอร์ส / โอน Member ให้ลูกค้าอีกคน) ───────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TransferModal({
  initType, initProg, courseMap, memberBalance, txMod,
  cust, activeBranchName, customers, onClose, onSuccess,
}: {
  initType:        "course" | "member";
  initProg:        string;
  courseMap:       Record<string, { bought: number; used: number; history: TxRecord[] }>;
  memberBalance:   number;
  txMod:           { spreadsheetId: string; sheetName: string; configName?: string } | null;
  cust:            Customer;
  activeBranchName: string;
  customers:       Customer[];
  onClose:         () => void;
  onSuccess:       () => void;
}) {
  const [type,        setType]        = useState<"course"|"member">(initType);
  const [prog,        setProg]        = useState(initProg);
  const [qty,         setQty]         = useState(1);
  const [memberAmt,   setMemberAmt]   = useState(0);
  const [fee,         setFee]         = useState(0);
  const [recipientId, setRecipientId] = useState("");
  const [recipQ,      setRecipQ]      = useState("");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState("");

  const availableCourses = Object.entries(courseMap)
    .filter(([, d]) => d.bought - d.used > 0)
    .map(([name]) => name);

  const remaining = prog && courseMap[prog] ? courseMap[prog].bought - courseMap[prog].used : 0;
  const pps       = useMemo(() => calcPricePerSession(prog, courseMap), [prog, courseMap]);

  const courseValue     = pps * qty;
  const feeAmt          = Math.round((type === "course" ? courseValue : memberAmt) * fee / 100);
  const recipientGets   = type === "course" ? qty : (memberAmt - feeAmt);
  const feeLabel        = fee > 0 ? ` ค่าธรรมเนียม ${fee}% = ฿${feeAmt.toLocaleString()}` : "";

  // Filter potential recipients (exclude self)
  const recipientOptions = customers.filter(c =>
    c.customer_id !== cust.customer_id &&
    (!recipQ || c.full_name.includes(recipQ) || c.phone_number?.includes(recipQ) || (c.nickname || "").includes(recipQ))
  );
  const recipient = customers.find(c => c.customer_id === recipientId);

  const handleSubmit = async () => {
    setErr("");
    if (!txMod) { setErr("ไม่มีข้อมูล Sales Transactions — กรุณาตั้งค่า"); return; }
    if (!recipientId) { setErr("กรุณาเลือกผู้รับ"); return; }
    if (!recipient)   { setErr("ไม่พบข้อมูลผู้รับ"); return; }
    if (type === "course") {
      if (!prog)              { setErr("กรุณาเลือกคอร์ส"); return; }
      if (qty < 1 || qty > remaining) { setErr(`จำนวนต้องอยู่ระหว่าง 1–${remaining} ครั้ง`); return; }
    } else {
      if (memberAmt <= 0)        { setErr("กรุณาระบุยอดที่โอน"); return; }
      if (memberAmt > memberBalance) { setErr(`ยอดโอนเกิน Member Balance (฿${memberBalance.toLocaleString()})`); return; }
      if (recipientGets <= 0)   { setErr("ยอดที่ผู้รับได้ต้องมากกว่า 0"); return; }
    }

    setSaving(true);
    try {
      const today = todayISO();
      const entries: any[] = [];

      if (type === "course") {
        // Sender — deduct sessions
        entries.push({
          customerId: cust.customer_id, customerName: cust.full_name, date: today,
          programStatus: "โอนคอร์ส", program: prog,
          quantity: qty,
          price:    feeAmt > 0 ? -feeAmt : 0,  // ค่าธรรมเนียม (ถ้ามี) = รายได้คลีนิก
          notes:    `โอน ${qty} ครั้ง ให้ ${recipient.full_name}${feeLabel}${notes ? ` — ${notes}` : ""}`,
          branchName: activeBranchName,
        });
        // Recipient — add sessions
        entries.push({
          customerId: recipient.customer_id, customerName: recipient.full_name, date: today,
          programStatus: "รับโอนคอร์ส", program: prog,
          quantity: qty, price: 0,
          notes:    `รับโอน ${qty} ครั้ง จาก ${cust.full_name}${notes ? ` — ${notes}` : ""}`,
          branchName: activeBranchName,
        });
      } else {
        // Sender — deduct member balance via col 36 (memberPayment)
        entries.push({
          customerId: cust.customer_id, customerName: cust.full_name, date: today,
          programStatus: "ตัด Member (โอน)", program: "Member",
          quantity: 1, price: memberAmt,
          memberPayment: memberAmt,   // col 36 — ให้ balance calculation หักได้
          notes:    `โอน ฿${memberAmt.toLocaleString()} ให้ ${recipient.full_name}${feeLabel}${notes ? ` — ${notes}` : ""}`,
          branchName: activeBranchName,
        });
        // Recipient — add member balance via qty
        entries.push({
          customerId: recipient.customer_id, customerName: recipient.full_name, date: today,
          programStatus: "เปิด Member (รับโอน)", program: "Member",
          quantity: recipientGets,  // qty = ยอด Member ที่ได้รับ
          price: 0,
          notes:    `รับโอน ฿${recipientGets.toLocaleString()} จาก ${cust.full_name}${notes ? ` — ${notes}` : ""}`,
          branchName: activeBranchName,
        });
      }

      const res = await fetch("/api/crm-demo/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: txMod.spreadsheetId, sheetName: txMod.sheetName, configName: txMod.configName || "Sales_Config", entries }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
      onSuccess();
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-md max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">โอนคอร์ส / Member</p>
              <p className="text-slate-500 text-[11px]">{cust.full_name} → ผู้รับ</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Type toggle */}
          <div className="flex gap-1.5 bg-white/[0.04] rounded-xl p-1">
            {(["course","member"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${type === t ? "bg-blue-500 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>
                {t === "course" ? "⇄ โอนคอร์ส" : "⇄ โอน Member"}
              </button>
            ))}
          </div>

          {/* Course config */}
          {type === "course" && (
            <div className="space-y-3">
              <div>
                <label className={F_LABEL}>เลือกคอร์ส *</label>
                <select value={prog} onChange={e => { setProg(e.target.value); setQty(1); }}
                  className={F_INPUT + " appearance-none"}>
                  <option value="">— เลือกคอร์สที่ต้องการโอน —</option>
                  {availableCourses.map(c => (
                    <option key={c} value={c}>{c} (เหลือ {courseMap[c].bought - courseMap[c].used} ครั้ง)</option>
                  ))}
                </select>
              </div>
              {prog && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={F_LABEL}>จำนวนครั้งที่โอน *</label>
                    <input type="number" min={1} max={remaining} value={qty}
                      onChange={e => setQty(Math.min(remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                      className={F_INPUT} />
                    <p className="text-slate-600 text-[10px] mt-0.5">สูงสุด {remaining} ครั้ง</p>
                  </div>
                  <div>
                    <label className={F_LABEL}>มูลค่า (เฉลี่ย)</label>
                    <div className={F_INPUT + " text-slate-400 flex items-center"}>
                      {pps > 0 ? `฿${(pps * qty).toLocaleString()}` : "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Member config */}
          {type === "member" && (
            <div>
              <label className={F_LABEL}>ยอดที่โอน *</label>
              <input type="number" min={1} max={memberBalance} value={memberAmt}
                onChange={e => setMemberAmt(Math.min(memberBalance, Math.max(0, parseFloat(e.target.value) || 0)))}
                className={F_INPUT} />
              <p className="text-slate-600 text-[10px] mt-0.5">Member Balance ปัจจุบัน ฿{memberBalance.toLocaleString()}</p>
            </div>
          )}

          {/* Recipient selector */}
          <div>
            <label className={F_LABEL}>ผู้รับ *</label>
            <input value={recipQ} onChange={e => { setRecipQ(e.target.value); setRecipientId(""); }}
              placeholder="ค้นหาชื่อ / เบอร์โทร..." className={F_INPUT + " mb-2"} />
            {recipientId && recipient ? (
              <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-white">{recipient.full_name}</p>
                  <p className="text-xs text-slate-400">{recipient.phone_number}</p>
                </div>
                <button onClick={() => { setRecipientId(""); setRecipQ(""); }}
                  className="text-slate-500 hover:text-slate-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ) : recipQ && recipientOptions.length === 0 ? (
              <p className="text-slate-600 text-xs px-1">ไม่พบลูกค้า</p>
            ) : recipQ ? (
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl max-h-36 overflow-y-auto">
                {recipientOptions.slice(0, 8).map(c => (
                  <button key={c.customer_id} onClick={() => { setRecipientId(c.customer_id); setRecipQ(c.full_name); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 font-bold text-xs flex-shrink-0">
                      {c.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{c.full_name}</p>
                      <p className="text-xs text-slate-500">{c.phone_number}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Transfer fee */}
          <div>
            <label className={F_LABEL}>ค่าธรรมเนียมการโอน (%) <span className="text-slate-600 font-normal">— default 0</span></label>
            <input type="number" min={0} max={100} step={0.5} value={fee}
              onChange={e => setFee(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              placeholder="0"
              className={F_INPUT} />
            {fee > 0 && <p className="text-[11px] text-blue-400/80 mt-1">ค่าธรรมเนียม ฿{feeAmt.toLocaleString()} → บันทึกเป็นรายได้คลีนิก</p>}
          </div>

          {/* Summary */}
          {recipientId && ((type === "course" && prog && qty > 0) || (type === "member" && memberAmt > 0)) && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 space-y-2">
              <p className="text-[10px] font-semibold text-blue-400/80 uppercase tracking-widest">สรุปการโอน</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ผู้ส่ง ({cust.full_name})</span>
                  <span className="text-white font-semibold">
                    {type === "course" ? `−${qty} ครั้ง` : `−฿${memberAmt.toLocaleString()}`}
                  </span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">ค่าธรรมเนียม {fee}%</span>
                    <span className="text-amber-400">฿{feeAmt.toLocaleString()} → คลีนิก</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-blue-300">ผู้รับ ({recipient?.full_name})</span>
                  <span className="text-blue-300">
                    {type === "course" ? `+${qty} ครั้ง` : `+฿${recipientGets.toLocaleString()}`}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-blue-600/80 flex items-start gap-1">
                <svg className="w-3 h-3 flex-shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                บันทึก 2 rows ใน Sales Transactions (ผู้ส่ง + ผู้รับ)
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={F_LABEL}>หมายเหตุ</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="เหตุผล / รายละเอียดการโอน (ไม่บังคับ)..."
              className={F_INPUT} />
          </div>

          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.07] flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={saving || !recipientId || (!prog && type==="course") || (type==="member" && memberAmt <= 0)}
            className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-40">
            {saving ? "กำลังบันทึก..." : "ยืนยันโอน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Dark Customer Detail Panel ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function DarkDetailPanel({
  cust, onClose, courses, apts, txMod, clientId, activeBranchName,
  isSuperAdmin, allBranches, customers, onEditCust, onOpenFollow, onOpenApt,
}: {
  cust:             Customer;
  onClose:          () => void;
  courses:          Course[];
  apts:             Appointment[];
  txMod:            { spreadsheetId: string; sheetName: string; configName?: string } | null;
  clientId:         string;
  activeBranchName: string;
  isSuperAdmin:     boolean;
  allBranches:      { branchId: string; branchName: string }[];
  customers:        Customer[];
  onEditCust:       (c: Customer) => void;
  onOpenFollow:     (c: Customer) => void;
  onOpenApt:        (c: Customer) => void;
}) {
  const [activeTab, setActiveTab] = useState("info");

  // ── Transaction state ─────────────────────────────────────────────────────
  const [txList,    setTxList]    = useState<TxRecord[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txLoaded,  setTxLoaded]  = useState<string | null>(null);
  const [txError,   setTxError]   = useState<string | null>(null);
  const [histOpen,  setHistOpen]  = useState<string | null>(null);

  // ── Return / Transfer modal state ─────────────────────────────────────────
  const [returnModal,   setReturnModal]   = useState<{ type: "course"|"member"; prog: string } | null>(null);
  const [transferModal, setTransferModal] = useState<{ type: "course"|"member"; prog: string } | null>(null);

  const loadTx = useCallback((custId: string) => {
    if (!txMod || txLoaded === custId) return;
    setTxLoading(true); setTxError(null);
    const params = new URLSearchParams({
      spreadsheetId: txMod.spreadsheetId,
      sheetName:     txMod.sheetName,
      configName:    txMod.configName || "Sales_Config",
      customerId:    custId,
    });
    fetch(`/api/crm-demo/transactions?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setTxError(d.error); return; }
        setTxList(d.transactions || []);
        setTxLoaded(custId);
      })
      .catch(e => setTxError(e.message))
      .finally(() => setTxLoading(false));
  }, [txMod, txLoaded]);

  useEffect(() => {
    if ((activeTab === "treatment" || activeTab === "course") && cust) loadTx(cust.customer_id);
  }, [activeTab, cust, loadTx]);

  useEffect(() => {
    setTxList([]); setTxLoaded(null); setHistOpen(null);
    setReturnModal(null); setTransferModal(null);
  }, [cust.customer_id]);

  /** Refresh tx after return/transfer — จะ trigger loadTx ใหม่ผ่าน useEffect */
  const handleTxSuccess = useCallback(() => {
    setTxList([]); setTxLoaded(null);
  }, []);

  // ── Photo browser state ───────────────────────────────────────────────────
  const [rootFolderId,      setRootFolderId]      = useState<string | null>(null);
  const [breadcrumb,        setBreadcrumb]        = useState<DriveFolder[]>([]);
  const [currentId,         setCurrentId]         = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState("หน้าหลัก");
  const [folders,           setFolders]           = useState<DriveFolder[]>([]);
  const [images,            setImages]            = useState<DriveImage[]>([]);
  const [photoLoading,      setPhotoLoading]      = useState(false);
  const [uploading,         setUploading]         = useState(false);
  const [lightbox,          setLightbox]          = useState<DriveImage | null>(null);
  const [uploadDate,        setUploadDate]        = useState(() => new Date().toISOString().slice(0, 10));
  const [photoRefresh,      setPhotoRefresh]      = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRootFolderId(null); setCurrentId(null); setBreadcrumb([]);
    setCurrentFolderName("หน้าหลัก"); setFolders([]); setImages([]); setLightbox(null);
  }, [cust.customer_id]);

  useEffect(() => {
    if (activeTab !== "photo" || !clientId) return;
    if (rootFolderId) return;
    setPhotoLoading(true);
    const params = new URLSearchParams({ clientId, action: "root", branchName: activeBranchName, customerId: cust.customer_id, customerName: cust.full_name });
    fetch(`/api/crm-demo/photos?${params.toString()}`)
      .then(r => r.json())
      .then(d => { if (d.folderId) { setRootFolderId(d.folderId); setCurrentId(d.folderId); setBreadcrumb([]); setCurrentFolderName("หน้าหลัก"); } })
      .catch(console.error)
      .finally(() => setPhotoLoading(false));
  }, [activeTab, cust, clientId, activeBranchName, rootFolderId]);

  useEffect(() => {
    if (!currentId || !clientId) return;
    setPhotoLoading(true);
    fetch(`/api/crm-demo/photos?clientId=${encodeURIComponent(clientId)}&action=list&folderId=${encodeURIComponent(currentId)}`)
      .then(r => r.json())
      .then(d => { setFolders(d.folders || []); setImages(d.images || []); })
      .catch(console.error)
      .finally(() => setPhotoLoading(false));
  }, [currentId, clientId, photoRefresh]);

  const enterFolder = useCallback((folder: DriveFolder) => {
    if (!currentId) return;
    setBreadcrumb(prev => [...prev, { id: currentId, name: currentFolderName }]);
    setCurrentFolderName(folder.name); setCurrentId(folder.id);
    setFolders([]); setImages([]);
  }, [currentId, currentFolderName]);

  const goBack = useCallback(() => {
    setBreadcrumb(prev => {
      const next = [...prev];
      const parent = next.pop();
      if (parent) { setCurrentId(parent.id); setCurrentFolderName(parent.name); }
      return next;
    });
    setFolders([]); setImages([]);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    if (!clientId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("clientId", clientId); fd.append("branchName", activeBranchName);
    fd.append("customerId", cust.customer_id); fd.append("customerName", cust.full_name);
    fd.append("date", uploadDate); fd.append("label", "photo"); fd.append("file", file);
    try {
      const res = await fetch("/api/crm-demo/photos", { method: "POST", body: fd });
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      setPhotoRefresh(k => k + 1);
    } catch (e: any) { alert("อัปโหลดไม่สำเร็จ: " + e.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }, [clientId, activeBranchName, cust, uploadDate]);

  const depth = breadcrumb.length;
  const fmtFolderName = (name: string, d: number) => {
    if (d === 1) return monthNames[name] || name;
    if (d === 2) return `วันที่ ${name}`;
    return name;
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const memberBalance = useMemo(() => {
    let bal = 0;
    for (const tx of txList) {
      if (isMemberAdd(tx))    bal += tx.quantity;        // เติม Member → อ่านจาก qty
      if (isMemberUsage(tx))  bal -= tx.member_payment;  // ใช้ Member จ่าย → อ่านจาก col 36
    }
    return bal;
  }, [txList]);

  const courseMap = useMemo(() => {
    const map: Record<string, { bought: number; used: number; history: TxRecord[] }> = {};
    for (const tx of txList) {
      const prog = tx.program;
      if (!prog || isMemberTx(tx)) continue;
      const action = tx.program_status;
      if (!isAddAction(action) && !isDeductAction(action)) continue;
      if (!map[prog]) map[prog] = { bought: 0, used: 0, history: [] };
      if (isAddAction(action))    map[prog].bought += tx.quantity;
      if (isDeductAction(action)) map[prog].used   += tx.quantity;
      map[prog].history.push(tx);
    }
    return map;
  }, [txList]);

  const memberHistory = useMemo(() =>
    txList
      .filter(tx => isMemberAdd(tx) || isMemberUsage(tx))
      .sort((a, b) => a.date.localeCompare(b.date))
  , [txList]);

  const ml  = cust.member_level || "ทั่วไป";
  const mcf = MEMBER_CFG[ml] || MEMBER_CFG["ทั่วไป"];
  const custApts = apts.filter(a => a.customer_id === cust.customer_id)
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
  const photoSrc = (img: DriveImage) =>
    img.thumbnailLink ? img.thumbnailLink.replace("=s220", "=s800") : `https://drive.google.com/uc?export=view&id=${img.id}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative bg-[#0d1425] border border-white/10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[88vh]"
          onClick={e => e.stopPropagation()}>

          {/* Drag handle */}
          <div className="flex sm:hidden justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 sm:py-4 border-b border-white/[0.07] flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/40 to-pink-500/40 flex items-center justify-center text-rose-300 font-bold text-lg flex-shrink-0">
              {cust.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate">{cust.full_name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-slate-400">{cust.nickname ? `(${cust.nickname}) · ` : ""}{cust.phone_number || "ไม่มีเบอร์"}</p>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${mcf.bg} ${mcf.text} ${mcf.border}`}>{ml}</span>
                {(cust as any).branch_id && (
                  <span className="text-[9px] bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 rounded-full text-slate-400">
                    {allBranches.find(b => b.branchId === (cust as any).branch_id)?.branchName || (cust as any).branch_id}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.07] flex-shrink-0 overflow-x-auto scrollbar-hide">
            {DETAIL_TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-shrink-0 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.id ? "border-rose-500 text-rose-400" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Tab: ข้อมูล ── */}
            {activeTab === "info" && (
              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: "เบอร์โทร", v: cust.phone_number || "-" },
                    { l: "LINE",     v: cust.line_id || "-" },
                    { l: "เพศ",      v: cust.gender || "-" },
                    { l: "วันเกิด",  v: fmtDate(cust.birthdate) || "-" },
                    { l: "ผิว",      v: cust.skin_type || "-" },
                    { l: "สมาชิก",  v: ml },
                  ].map(({ l, v }) => (
                    <div key={l} className="bg-white/[0.04] rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/70 mb-0.5">{l}</p>
                      <p className="text-sm font-semibold text-white">{v}</p>
                    </div>
                  ))}
                </div>
                {(cust.allergy || cust.medical_history) && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <div>
                      {cust.allergy         && <p className="text-xs font-bold text-amber-400">แพ้: {cust.allergy}</p>}
                      {cust.medical_history && <p className="text-xs text-amber-400/80">โรค: {cust.medical_history}</p>}
                    </div>
                  </div>
                )}
                {cust.notes && (
                  <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-0.5">หมายเหตุ</p>
                    <p className="text-xs text-slate-400">{cust.notes}</p>
                  </div>
                )}
                {custApts.slice(0, 3).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-rose-500/70 mb-2">นัดหมายล่าสุด</p>
                    <div className="space-y-1.5">
                      {custApts.slice(0, 3).map(a => {
                        const sc = APT_S_CFG[a.status] || { l: a.status, bg: "bg-slate-500/15", text: "text-slate-400" };
                        return (
                          <div key={a.appointment_id} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2">
                            <div>
                              <p className="text-xs font-semibold text-white">{fmtDate(a.appointment_date)} · {a.appointment_time}</p>
                              <p className="text-xs text-slate-400">{a.service}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{sc.l}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: ประวัติรักษา ── */}
            {activeTab === "treatment" && (
              <div className="px-4 py-3 space-y-2">
                {!txMod && (
                  <div className="py-10 flex flex-col items-center text-center">
                    <p className="text-sm font-semibold text-slate-400">ไม่ได้เชื่อมข้อมูล Sales Transactions</p>
                    <p className="text-xs text-slate-500 mt-1">เพิ่ม txSid/txSheet ใน URL params</p>
                  </div>
                )}
                {txMod && txError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3 text-xs text-red-400">
                    <p className="font-bold mb-1">เกิดข้อผิดพลาด</p>
                    <p className="font-mono break-all">{txError}</p>
                  </div>
                )}
                {txMod && txLoading && (
                  <div className="flex justify-center py-10">
                    <svg className="w-6 h-6 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  </div>
                )}
                {txMod && !txLoading && !txError && txList.length === 0 && (
                  <div className="py-10 flex flex-col items-center text-center text-slate-500">
                    <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    <p className="text-sm">ยังไม่มีประวัติการรักษา</p>
                  </div>
                )}
                {txMod && !txLoading && txList.map((tx, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-xs font-bold text-white">{fmtDate(tx.date) || tx.date}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tx.usedCourse && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">ใช้คอร์ส</span>}
                        {/คืน/i.test(tx.program_status) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">คืนเงิน</span>}
                        {/โอน/i.test(tx.program_status) && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">โอน</span>}
                        {tx.branch_name && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">{tx.branch_name}</span>}
                      </div>
                    </div>
                    {tx.program && <p className="text-sm font-semibold text-white leading-snug">{tx.program}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {tx.program_status && <span className="text-[11px] text-slate-500">{tx.program_status}</span>}
                      {!!tx.quantity && <span className="text-[11px] text-slate-500">จำนวน <span className="font-semibold text-slate-300">{tx.quantity}</span></span>}
                      {tx.doctor && <span className="text-[11px] text-slate-500">แพทย์ <span className="font-semibold text-slate-300">{tx.doctor}</span></span>}
                      {tx.staff  && <span className="text-[11px] text-slate-500">BT <span className="font-semibold text-slate-300">{tx.staff}</span></span>}
                      {tx.price !== 0 && <span className={`text-[11px] font-semibold ${tx.price < 0 ? "text-amber-400" : "text-slate-300"}`}>{tx.price < 0 ? `↑ คืน ฿${Math.abs(tx.price).toLocaleString()}` : `฿${tx.price.toLocaleString()}`}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab: คอร์ส / Member ── */}
            {activeTab === "course" && (
              <div className="px-4 py-4 space-y-4">
                {txLoading ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-rose-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    <span className="text-sm">กำลังโหลด...</span>
                  </div>
                ) : txError ? (
                  <div className="py-8 text-center text-sm text-red-400">{txError}</div>
                ) : !txMod ? (
                  <div className="py-8 text-center text-sm text-slate-500">ไม่ได้ตั้งค่า Sales Transactions module</div>
                ) : (
                  <>
                    {/* ── Member card ── */}
                    <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-pink-500/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/40 to-pink-500/40 flex items-center justify-center">
                            <svg className="w-4 h-4 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          </div>
                          <p className="font-bold text-white text-sm">Member Balance</p>
                        </div>
                        <button onClick={() => setHistOpen(histOpen === "__member__" ? null : "__member__")}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline">
                          {histOpen === "__member__" ? "ซ่อน" : "ดูรายการ"}
                        </button>
                      </div>

                      <p className={`text-2xl font-bold ${memberBalance < 0 ? "text-red-400" : "text-rose-400"}`}>
                        ฿{memberBalance.toLocaleString()}
                      </p>
                      {memberBalance < 0 && <p className="text-[10px] text-red-400 mt-0.5">⚠ ยอดติดลบ</p>}

                      {/* ── Member action buttons ── */}
                      {memberBalance > 0 && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setReturnModal({ type: "member", prog: "" })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-semibold transition-colors border border-amber-500/20">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                            คืน Member
                          </button>
                          <button onClick={() => setTransferModal({ type: "member", prog: "" })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-xs font-semibold transition-colors border border-blue-500/20">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                            โอน Member
                          </button>
                        </div>
                      )}

                      {histOpen === "__member__" && (
                        <div className="mt-3 pt-3 border-t border-rose-500/20 space-y-1.5">
                          {memberHistory.length === 0
                            ? <p className="text-xs text-slate-500 text-center py-2">ไม่มีรายการ</p>
                            : memberHistory.map((tx, i) => {
                                const isAdd   = isMemberAdd(tx);
                                const amount  = isAdd ? tx.quantity : tx.member_payment;
                                const label   = isAdd ? "เติม Member" : (tx.program ? `ใช้ · ${tx.program}` : "ใช้ Member");
                                return (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${isAdd ? "bg-emerald-500" : "bg-rose-500"}`}>
                                        {isAdd ? "+" : "−"}
                                      </span>
                                      <span className="text-slate-400">{fmtDate(tx.date)}</span>
                                      <span className="text-slate-600">·</span>
                                      <span className="text-slate-400">{label}</span>
                                      {tx.branch_name && <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded">{tx.branch_name}</span>}
                                    </div>
                                    <span className={`font-bold ${isAdd ? "text-emerald-400" : "text-rose-400"}`}>
                                      {isAdd ? "+" : "−"}฿{amount.toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })
                          }
                        </div>
                      )}
                    </div>

                    {/* ── Courses ── */}
                    {Object.keys(courseMap).length === 0 ? (
                      <div className="py-6 text-center text-sm text-slate-500">ไม่มีคอร์สที่ซื้อ</div>
                    ) : (
                      Object.entries(courseMap).map(([prog, data]) => {
                        const remaining   = data.bought - data.used;
                        const pct         = data.bought > 0 ? Math.min((data.used / data.bought) * 100, 100) : 0;
                        const isOpen      = histOpen === prog;
                        const branchSet   = [...new Set(data.history.map(tx => tx.branch_name).filter(Boolean))];
                        const pps         = calcPricePerSession(prog, courseMap);
                        return (
                          <div key={prog} className={`rounded-2xl border p-4 ${remaining <= 0 ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/[0.04] border-white/[0.08]"}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{prog}</p>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <p className="text-xs text-slate-500">ซื้อ {data.bought} · ใช้ {data.used} ครั้ง</p>
                                  {pps > 0 && <p className="text-xs text-slate-600">฿{pps.toLocaleString()}/ครั้ง</p>}
                                  {branchSet.map(bn => (
                                    <span key={bn} className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/15 px-1.5 py-0.5 rounded-full">{bn}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${remaining > 0 ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" : "bg-slate-500/15 text-slate-400"}`}>
                                  {remaining > 0 ? `เหลือ ${remaining} ครั้ง` : "หมดแล้ว"}
                                </span>
                                <button onClick={() => setHistOpen(isOpen ? null : prog)}
                                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline">
                                  {isOpen ? "ซ่อน" : "รายการ"}
                                </button>
                              </div>
                            </div>

                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: remaining > 0 ? "linear-gradient(90deg,#f43f5e,#ec4899)" : "#475569" }} />
                            </div>

                            {/* ── Course action buttons ── */}
                            {remaining > 0 && (
                              <div className="flex gap-2 mb-1">
                                <button onClick={() => setReturnModal({ type: "course", prog })}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-500/12 hover:bg-amber-500/22 text-amber-400 text-[11px] font-semibold transition-colors border border-amber-500/20">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                  คืนคอร์ส
                                </button>
                                <button onClick={() => setTransferModal({ type: "course", prog })}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/12 hover:bg-blue-500/22 text-blue-400 text-[11px] font-semibold transition-colors border border-blue-500/20">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                                  โอนคอร์ส
                                </button>
                              </div>
                            )}

                            {isOpen && (
                              <div className="mt-2 pt-3 border-t border-white/[0.06] space-y-1.5">
                                {data.history.sort((a,b) => b.date.localeCompare(a.date)).map((tx, i) => {
                                  const isAdd = isAddAction(tx.program_status);
                                  const isRet = /คืน/i.test(tx.program_status);
                                  const isTx  = /โอน/i.test(tx.program_status);
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${isAdd ? "bg-emerald-500" : isRet ? "bg-amber-500" : isTx ? "bg-blue-500" : "bg-rose-500"}`}>
                                          {isAdd ? "+" : "−"}
                                        </span>
                                        <span className="text-slate-400">{fmtDate(tx.date)}</span>
                                        <span className="text-slate-600">·</span>
                                        <span className="text-slate-400">{tx.program_status}</span>
                                        {tx.branch_name && <span className="text-[9px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded">{tx.branch_name}</span>}
                                      </div>
                                      <span className={`font-bold ${isAdd ? "text-emerald-400" : isRet ? "text-amber-400" : "text-rose-400"}`}>
                                        {isAdd ? "+" : "−"}{tx.quantity} ครั้ง
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Tab: รูปภาพ ── */}
            {activeTab === "photo" && (
              <div className="flex flex-col h-full">
                {!clientId ? (
                  <div className="py-10 text-center text-slate-500 text-sm">ไม่ได้ตั้งค่า clientId — ไม่สามารถใช้งาน Drive ได้</div>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-white/[0.06] flex-shrink-0 flex items-center gap-2">
                      <input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)}
                        className="text-[11px] bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-rose-500/50 flex-shrink-0"/>
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-rose-500/25 text-rose-400 hover:bg-rose-500/5 transition-colors text-xs font-semibold disabled:opacity-50">
                        {uploading
                          ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>อัปโหลด...</>
                          : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>อัปโหลดรูปภาพ</>}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={async e => { const files = Array.from(e.target.files || []); for (const f of files) await handleUpload(f); }} />
                    </div>
                    {breadcrumb.length > 0 && (
                      <div className="px-4 py-2 flex items-center gap-1 text-xs text-slate-500 flex-shrink-0 border-b border-white/[0.06] flex-wrap">
                        <button onClick={() => { setCurrentId(rootFolderId); setBreadcrumb([]); setCurrentFolderName("หน้าหลัก"); setFolders([]); setImages([]); }}
                          className="text-rose-400 hover:underline font-semibold">หน้าหลัก</button>
                        {breadcrumb.slice(1).map((b, i) => (
                          <span key={b.id} className="flex items-center gap-1">
                            <span className="text-slate-600">/</span>
                            <button onClick={() => {
                              const idx = i + 1;
                              const target = breadcrumb[idx];
                              setBreadcrumb(prev => prev.slice(0, idx));
                              setCurrentId(target.id); setCurrentFolderName(target.name);
                              setFolders([]); setImages([]);
                            }} className="hover:underline">{fmtFolderName(b.name, i)}</button>
                          </span>
                        ))}
                        <span className="text-slate-600">/</span>
                        <span className="font-semibold text-slate-300">{fmtFolderName(currentFolderName, depth - 1)}</span>
                      </div>
                    )}
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                      {photoLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <svg className="w-6 h-6 animate-spin text-rose-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        </div>
                      ) : (
                        <>
                          {folders.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {breadcrumb.length > 0 && (
                                <button onClick={goBack} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] transition-colors">
                                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                                  <span className="text-[10px] text-slate-500 font-medium">ย้อนกลับ</span>
                                </button>
                              )}
                              {folders.map(f => (
                                <button key={f.id} onClick={() => enterFolder(f)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 transition-colors">
                                  <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                                  <span className="text-[10px] text-amber-400 font-semibold text-center leading-tight">{fmtFolderName(f.name, depth)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {folders.length === 0 && breadcrumb.length > 0 && (
                            <button onClick={goBack} className="flex items-center gap-1.5 mb-3 text-xs text-slate-500 hover:text-slate-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>ย้อนกลับ
                            </button>
                          )}
                          {images.length > 0 && (
                            <div className="grid grid-cols-3 gap-1.5">
                              {images.map(img => (
                                <button key={img.id} onClick={() => setLightbox(img)}
                                  className="aspect-square rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06] relative group">
                                  <img src={photoSrc(img)} alt={img.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                                </button>
                              ))}
                            </div>
                          )}
                          {folders.length === 0 && images.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-2">
                                <svg className="w-6 h-6 text-rose-500/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                              </div>
                              <p className="text-xs text-slate-500">ยังไม่มีรูปภาพ</p>
                              <p className="text-[10px] text-slate-600 mt-0.5">กดอัปโหลดรูปด้านบน</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Lightbox */}
            {lightbox && (
              <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                {lightbox.webViewLink && (
                  <a href={lightbox.webViewLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    เปิดใน Drive
                  </a>
                )}
                <img src={photoSrc(lightbox)} alt={lightbox.name}
                  className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                  onClick={e => e.stopPropagation()} />
                <div className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs">{lightbox.name}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-3 border-t border-white/[0.07] flex-shrink-0">
            <button onClick={() => { onEditCust(cust); onClose(); }}
              className="py-2.5 px-4 rounded-xl bg-white/[0.06] text-slate-400 text-xs font-semibold hover:bg-white/10 transition-colors">
              แก้ไข
            </button>
            <button onClick={() => { onOpenFollow(cust); onClose(); }}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-xs font-semibold hover:bg-rose-500/15 hover:text-rose-400 transition-colors flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              ติดตาม
            </button>
            <button onClick={() => { onOpenApt(cust); onClose(); }}
              className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors shadow-lg shadow-rose-500/20 flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              นัดหมาย
            </button>
          </div>
        </div>
      </div>

      {/* Return modal */}
      {returnModal && (
        <ReturnModal
          initType={returnModal.type}
          initProg={returnModal.prog}
          courseMap={courseMap}
          memberBalance={memberBalance}
          txMod={txMod}
          cust={cust}
          activeBranchName={activeBranchName}
          onClose={() => setReturnModal(null)}
          onSuccess={handleTxSuccess}
        />
      )}

      {/* Transfer modal */}
      {transferModal && (
        <TransferModal
          initType={transferModal.type}
          initProg={transferModal.prog}
          courseMap={courseMap}
          memberBalance={memberBalance}
          txMod={txMod}
          cust={cust}
          activeBranchName={activeBranchName}
          customers={customers}
          onClose={() => setTransferModal(null)}
          onSuccess={handleTxSuccess}
        />
      )}
    </>
  );
}

// ── Main CustTab ─────────────────────────────────────────────────────────────
export default function CustTab({
  customers, courses, apts, branchId, isSuperAdmin, allBranches,
  onOpenCust, onEditCust, onTransfer,
  txMod, clientId, activeBranchName, onOpenFollow, onOpenApt,
}: Props) {
  const [q, setQ] = useState("");
  const [transferCust, setTransferCust] = useState<Customer | null>(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [viewDetail, setViewDetail] = useState<Customer | null>(null);

  const filtered = customers
    .filter(c => !q || c.full_name.includes(q) || c.phone_number.includes(q) || (c.nickname || "").includes(q) || c.customer_id.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.customer_id.localeCompare(b.customer_id, undefined, { numeric: true, sensitivity: "base" }));

  const custApts    = (id: string) => apts.filter(a => a.customer_id === id).length;
  const custCourses = (id: string) => courses.filter(c => c.customer_id === id).length;
  const memberCfg   = (level: string) => MEMBER_CFG[level] || MEMBER_CFG["ทั่วไป"];

  const confirmTransfer = () => {
    if (!transferCust || !transferTarget) return;
    const branch = allBranches.find(b => b.branchId === transferTarget);
    if (branch) onTransfer(transferCust, branch.branchId, branch.branchName);
    setTransferCust(null); setTransferTarget("");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร รหัสลูกค้า..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50 transition-colors" />
        </div>
        <button onClick={onOpenCust}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          เพิ่มลูกค้า
        </button>
      </div>

      <p className="text-slate-600 text-xs">พบ {filtered.length} คน</p>

      {/* Customer cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(c => {
          const mc = memberCfg(c.member_level);
          const cb = (c as any).branch_id;
          const branchLabel = allBranches.find(b => b.branchId === cb)?.branchName || (cb ? cb : "—");
          return (
            <div key={c.customer_id}
              className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-2xl p-4 transition-colors cursor-pointer"
              onClick={() => setViewDetail(c)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/40 to-pink-500/40 flex items-center justify-center text-rose-300 font-bold text-sm flex-shrink-0">
                  {c.full_name.charAt(0)}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${mc.bg} ${mc.text} ${mc.border}`}>
                  {c.member_level || "ทั่วไป"}
                </span>
              </div>

              <p className="text-white font-semibold text-sm truncate">{c.full_name}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.nickname && <p className="text-slate-500 text-xs">({c.nickname})</p>}
                <span className="text-[10px] font-mono text-rose-400/70 bg-rose-500/10 px-1.5 py-0.5 rounded">#{c.customer_id}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">{c.phone_number}</p>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05] text-[11px] text-slate-500">
                <span>📅 {custApts(c.customer_id)} นัด</span>
                <span>🗂 {custCourses(c.customer_id)} คอร์ส</span>
                <span className="ml-auto text-rose-400/70">{branchLabel}</span>
              </div>

              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEditCust(c)}
                  className="flex-1 py-1.5 rounded-lg bg-white/[0.06] hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 text-xs font-medium transition-colors">
                  แก้ไข
                </button>
                {isSuperAdmin && (
                  <button onClick={() => { setTransferCust(c); setTransferTarget(""); }}
                    className="flex-1 py-1.5 rounded-lg bg-white/[0.06] hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 text-xs font-medium transition-colors">
                    โอนสาขา
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-slate-600">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <p className="text-sm">ไม่พบลูกค้า</p>
        </div>
      )}

      {/* Customer detail panel */}
      {viewDetail && (
        <DarkDetailPanel
          cust={viewDetail}
          onClose={() => setViewDetail(null)}
          courses={courses}
          apts={apts}
          txMod={txMod}
          clientId={clientId}
          activeBranchName={activeBranchName}
          isSuperAdmin={isSuperAdmin}
          allBranches={allBranches}
          customers={customers}
          onEditCust={c => { onEditCust(c); setViewDetail(null); }}
          onOpenFollow={c => { onOpenFollow(c); setViewDetail(null); }}
          onOpenApt={c => { onOpenApt(c); setViewDetail(null); }}
        />
      )}

      {/* Branch transfer modal */}
      {transferCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setTransferCust(null)}>
          <div className="bg-[#131929] border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold mb-1">โอนสาขา</h3>
            <p className="text-slate-400 text-sm mb-4">{transferCust.full_name}</p>
            <select value={transferTarget} onChange={e => setTransferTarget(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm mb-4 focus:outline-none focus:border-rose-500/50">
              <option value="">— เลือกสาขา —</option>
              {allBranches.map(b => <option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setTransferCust(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/10 transition-colors">
                ยกเลิก
              </button>
              <button onClick={confirmTransfer} disabled={!transferTarget}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-40">
                ยืนยันโอน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
