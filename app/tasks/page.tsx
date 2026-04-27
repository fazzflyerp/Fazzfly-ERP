/**
 * Tasks Page
 * /tasks — จัดการงาน assign ให้ Staff
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/app/context/UserRoleContext";
import QuickNav, { QuickNavTrigger } from "@/app/components/QuickNav";

interface Task {
  taskId: string;
  assignerEmail: string;
  assigneeEmail: string;
  title: string;
  dueDate: string;
  status: string;
  createdAt: string;
  isRead: boolean;
  description: string;
}

interface User {
  email: string;
  role: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "รอดำเนินการ", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  done:    { label: "เสร็จแล้ว",   cls: "bg-green-100 text-green-700 border-green-200" },
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IcInbox    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>;
const IcSent     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>;
const IcCalendar = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
const IcAlert    = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;
const IcOverdue  = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IcCheck    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>;
const IcEmpty    = () => <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>;
const IcSuccess  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IcError    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const IcDoneBig  = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>;

function isDueSoon(dueDate: string): boolean {
  if (!dueDate) return false;
  try {
    const [d, m, y] = dueDate.split("/").map(Number);
    const diff = (new Date(y, m - 1, d).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 2;
  } catch { return false; }
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  try {
    const [d, m, y] = dueDate.split("/").map(Number);
    return new Date(y, m - 1, d).getTime() < Date.now();
  } catch { return false; }
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const { loading: roleLoading } = useUserRole();
  const router = useRouter();

  const [navOpen, setNavOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Form
  const [showForm, setShowForm]           = useState(false);
  const [formTitle, setFormTitle]         = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignee, setFormAssignee]   = useState("");
  const [formDue, setFormDue]             = useState("");
  const [formDueRaw, setFormDueRaw]       = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitOk, setSubmitOk]           = useState<boolean | null>(null);
  const [submitMsg, setSubmitMsg]         = useState("");

  // Detail
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?mode=${tab}`);
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch {} finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/tasks/users");
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch {}
  };

  useEffect(() => {
    if (session) { fetchTasks(); fetchUsers(); }
  }, [session, tab]);

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formAssignee) return;
    setSubmitting(true);
    setSubmitMsg("");
    setSubmitOk(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeEmail: formAssignee, title: formTitle.trim(), dueDate: formDue, description: formDescription.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitOk(true);
        setSubmitMsg("มอบหมายงานสำเร็จ");
        setFormTitle(""); setFormDescription(""); setFormAssignee(""); setFormDue(""); setFormDueRaw("");
        setShowForm(false);
        if (tab === "sent") fetchTasks();
      } else {
        setSubmitOk(false);
        setSubmitMsg(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (e: any) {
      setSubmitOk(false);
      setSubmitMsg(e.message);
    } finally {
      setSubmitting(false);
      setTimeout(() => { setSubmitMsg(""); setSubmitOk(null); }, 4000);
    }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    await fetch("/api/tasks/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status: newStatus, isRead: true }),
    });
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, status: newStatus, isRead: true } : t));
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doneCount    = tasks.filter((t) => t.status === "done").length;

  if (status === "loading" || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif" }}>

      <QuickNav isOpen={navOpen} onClose={() => setNavOpen(false)} />

      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <QuickNavTrigger onClick={() => setNavOpen(true)} />
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-900 leading-none">Task Manager</h1>
            <p className="text-xs text-slate-500 mt-0.5">มอบหมายและติดตามงาน</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            มอบหมายงาน
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "ทั้งหมด",       value: tasks.length,  color: "text-violet-600", border: "border-violet-100" },
            { label: "รอดำเนินการ",   value: pendingCount,  color: "text-amber-600",  border: "border-amber-100"  },
            { label: "เสร็จแล้ว",     value: doneCount,     color: "text-green-600",  border: "border-green-100"  },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-4 text-center shadow-sm`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 bg-white rounded-xl p-1.5 border border-slate-100 shadow-sm">
          <button onClick={() => setTab("inbox")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "inbox" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
            <IcInbox /><span>งานที่ได้รับ</span>
          </button>
          <button onClick={() => setTab("sent")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "sent" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
            <IcSent /><span>งานที่มอบหมาย</span>
          </button>
        </div>

        {/* Submit message */}
        {submitMsg && (
          <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${submitOk ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {submitOk ? <IcSuccess /> : <IcError />}
            <span>{submitMsg}</span>
          </div>
        )}

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-slate-300 flex justify-center mb-3"><IcEmpty /></div>
            <p className="text-slate-700 font-semibold">ยังไม่มีงาน</p>
            <p className="text-slate-400 text-sm mt-1">
              {tab === "inbox" ? "ยังไม่มีงานที่ได้รับมอบหมาย" : "กดปุ่ม 'มอบหมายงาน' เพื่อเริ่ม"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => {
              const badge   = STATUS_MAP[task.status] || STATUS_MAP.pending;
              const overdue = task.status === "pending" && isOverdue(task.dueDate);
              const soon    = task.status === "pending" && !overdue && isDueSoon(task.dueDate);

              return (
                <div key={task.taskId}
                  onClick={() => setSelectedTask(task)}
                  className={`bg-white rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-all ${!task.isRead && tab === "inbox" ? "border-violet-200 ring-1 ring-violet-100" : "border-slate-100"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${task.status === "done" ? "bg-green-400" : "bg-amber-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className={`text-sm font-semibold text-slate-900 leading-snug ${task.status === "done" ? "line-through text-slate-400" : ""}`}>
                          {task.title}
                        </p>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-500 mb-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {tab === "inbox"
                          ? <span>จาก: <span className="font-medium text-slate-700">{task.assignerEmail}</span></span>
                          : <span>ถึง: <span className="font-medium text-slate-700">{task.assigneeEmail}</span></span>
                        }
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 font-medium ${overdue ? "text-red-500" : soon ? "text-amber-500" : "text-slate-500"}`}>
                            {overdue ? <IcOverdue /> : soon ? <IcAlert /> : <IcCalendar />}
                            {overdue ? "เกินกำหนด: " : soon ? "ใกล้ครบ: " : ""}{task.dueDate}
                          </span>
                        )}
                        <span className="text-slate-400">{task.createdAt}</span>
                      </div>
                    </div>
                    {tab === "inbox" && task.status === "pending" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus(task.taskId, "done"); }}
                        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                      >
                        <IcCheck />เสร็จ
                      </button>
                    )}
                    {tab === "sent" && task.status === "done" && (
                      <div className="flex-shrink-0 text-green-500"><IcCheck /></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedTask.status === "done" ? "bg-green-400" : "bg-amber-400"}`} />
                <h2 className={`text-base font-bold text-slate-900 leading-snug ${selectedTask.status === "done" ? "line-through text-slate-400" : ""}`}>
                  {selectedTask.title}
                </h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedTask.description ? (
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">รายละเอียด</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{selectedTask.description}</p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-slate-400">ไม่มีรายละเอียดเพิ่มเติม</p>
              </div>
            )}

            <div className="space-y-2.5 mb-5 text-sm">
              {[
                { label: "สถานะ",        value: null,                        badge: true  },
                { label: "มอบหมายโดย",   value: selectedTask.assignerEmail,  badge: false },
                { label: "มอบหมายให้",   value: selectedTask.assigneeEmail,  badge: false },
                ...(selectedTask.dueDate ? [{ label: "กำหนดส่ง", value: selectedTask.dueDate, badge: false, due: true }] : []),
                { label: "สร้างเมื่อ",  value: selectedTask.createdAt,      badge: false },
              ].map((row: any) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 flex-shrink-0">{row.label}</span>
                  {row.badge ? (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${(STATUS_MAP[selectedTask.status] || STATUS_MAP.pending).cls}`}>
                      {(STATUS_MAP[selectedTask.status] || STATUS_MAP.pending).label}
                    </span>
                  ) : (
                    <span className={`text-xs font-medium text-right truncate max-w-[200px] ${row.due && isOverdue(row.value) && selectedTask.status === "pending" ? "text-red-600 font-semibold" : row.due && isDueSoon(row.value) && selectedTask.status === "pending" ? "text-amber-600 font-semibold" : "text-slate-800"}`}>
                      {row.value}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {tab === "inbox" && selectedTask.status === "pending" && (
              <button
                onClick={() => { updateStatus(selectedTask.taskId, "done"); setSelectedTask(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all"
              >
                <IcDoneBig />ทำเสร็จแล้ว
              </button>
            )}
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">มอบหมายงานใหม่</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-900 block mb-1.5">หัวข้องาน <span className="text-red-500">*</span></label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="ชื่อหรือหัวข้องานสั้นๆ..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-900 block mb-1.5">
                รายละเอียด <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span>
              </label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                placeholder="อธิบายรายละเอียดงานเพิ่มเติม..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-900 block mb-1.5">มอบหมายให้ <span className="text-red-500">*</span></label>
              <select value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white"
              >
                <option value="">-- เลือกพนักงาน --</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email} ({u.role === "STAFF" ? "Staff" : "Admin"})
                  </option>
                ))}
              </select>
              {users.length === 0 && <p className="text-xs text-slate-400 mt-1">ไม่พบพนักงานอื่นในระบบ</p>}
            </div>

            <div className="mb-6">
              <label className="text-sm font-semibold text-slate-900 block mb-1.5">กำหนดส่ง <span className="text-slate-400 font-normal text-xs">(ไม่บังคับ)</span></label>
              <input type="date" value={formDueRaw}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormDueRaw(val);
                  if (val) {
                    const [y, m, d] = val.split("-");
                    setFormDue(`${d}/${m}/${y}`);
                  } else {
                    setFormDue("");
                  }
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
              {formDue && <p className="text-xs text-slate-500 mt-1">กำหนดส่ง: <span className="font-medium">{formDue}</span></p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSubmit}
                disabled={submitting || !formTitle.trim() || !formAssignee}
                className="flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-all">
                {submitting ? "กำลังส่ง..." : "ส่งงาน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
