/**
 * Tasks Page
 * /tasks — จัดการงาน assign ให้ Staff
 */
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/app/context/UserRoleContext";

interface Task {
  taskId: string;
  assignerEmail: string;
  assigneeEmail: string;
  title: string;
  dueDate: string;
  status: string;
  createdAt: string;
  isRead: boolean;
}

interface User {
  email: string;
  role: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "รอดำเนินการ", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  done:    { label: "เสร็จแล้ว",   cls: "bg-green-100 text-green-700 border-green-200" },
};

function isDueSoon(dueDate: string): boolean {
  if (!dueDate) return false;
  try {
    const parts = dueDate.split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      const due = new Date(y, m - 1, d);
      const diff = (due.getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 2;
    }
  } catch {}
  return false;
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  try {
    const parts = dueDate.split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d).getTime() < Date.now();
    }
  } catch {}
  return false;
}

export default function TasksPage() {
  const { data: session, status } = useSession();
  const { isAdmin, role, loading: roleLoading } = useUserRole();
  const router = useRouter();

  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formDue, setFormDue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?mode=${tab}`);
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch {}
    finally { setLoading(false); }
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
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeEmail: formAssignee, title: formTitle.trim(), dueDate: formDue }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitMsg("✅ มอบหมายงานสำเร็จ");
        setFormTitle(""); setFormAssignee(""); setFormDue("");
        setShowForm(false);
        if (tab === "sent") fetchTasks();
      } else {
        setSubmitMsg("❌ " + (data.error || "เกิดข้อผิดพลาด"));
      }
    } catch (e: any) {
      setSubmitMsg("❌ " + e.message);
    } finally {
      setSubmitting(false);
      setTimeout(() => setSubmitMsg(""), 4000);
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    await fetch("/api/tasks/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status, isRead: true }),
    });
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, status, isRead: true } : t));
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doneCount    = tasks.filter((t) => t.status === "done").length;

  if (status === "loading" || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 pb-20"
      style={{ fontFamily: "var(--font-noto-sans-thai), sans-serif" }}>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-violet-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/select-system")} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Task Manager</h1>
            <p className="text-xs text-slate-500">มอบหมายและติดตามงาน</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            มอบหมายงาน
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/90 rounded-2xl border border-violet-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-violet-600">{tasks.length}</p>
            <p className="text-xs text-slate-500 mt-1">ทั้งหมด</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-amber-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1">รอดำเนินการ</p>
          </div>
          <div className="bg-white/90 rounded-2xl border border-green-100 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{doneCount}</p>
            <p className="text-xs text-slate-500 mt-1">เสร็จแล้ว</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 bg-white/60 backdrop-blur rounded-xl p-1.5 border border-violet-100">
          {(["inbox", "sent"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-white shadow-sm text-violet-700" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "inbox" ? "📥 งานที่ได้รับ" : "📤 งานที่มอบหมาย"}
            </button>
          ))}
        </div>

        {submitMsg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${submitMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {submitMsg}
          </div>
        )}

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 bg-white/60 rounded-2xl border border-violet-100">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-600 font-medium">ยังไม่มีงาน</p>
            <p className="text-slate-400 text-sm mt-1">
              {tab === "inbox" ? "ยังไม่มีงานที่ได้รับมอบหมาย" : "กดปุ่ม 'มอบหมายงาน' เพื่อเริ่ม"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const badge = STATUS_MAP[task.status] || STATUS_MAP.pending;
              const overdue = task.status === "pending" && isOverdue(task.dueDate);
              const soon    = task.status === "pending" && !overdue && isDueSoon(task.dueDate);

              return (
                <div key={task.taskId}
                  className={`bg-white/90 rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${!task.isRead && tab === "inbox" ? "border-violet-200 bg-violet-50/30" : "border-slate-100"}`}>
                  <div className="flex items-start gap-3">
                    {/* status indicator */}
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${task.status === "done" ? "bg-green-400" : "bg-amber-400"}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className={`font-semibold text-slate-800 ${task.status === "done" ? "line-through text-slate-400" : ""}`}>
                          {task.title}
                        </p>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {tab === "inbox"
                          ? <span>จาก: <span className="font-medium text-slate-700">{task.assignerEmail}</span></span>
                          : <span>ถึง: <span className="font-medium text-slate-700">{task.assigneeEmail}</span></span>
                        }
                        {task.dueDate && (
                          <span className={`font-medium ${overdue ? "text-red-500" : soon ? "text-amber-500" : "text-slate-500"}`}>
                            {overdue ? "🔴 เกินกำหนด: " : soon ? "⚠️ ใกล้ครบ: " : "📅 "}
                            {task.dueDate}
                          </span>
                        )}
                        <span className="text-slate-400">{task.createdAt}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {tab === "inbox" && task.status === "pending" && (
                      <button
                        onClick={() => updateStatus(task.taskId, "done")}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                      >
                        ✓ เสร็จ
                      </button>
                    )}
                    {tab === "sent" && task.status === "done" && (
                      <span className="flex-shrink-0 text-green-500 text-lg">✅</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800">มอบหมายงานใหม่</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Task Title */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">รายละเอียดงาน <span className="text-red-400">*</span></label>
              <textarea
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="พิมพ์รายละเอียดงานที่ต้องการมอบหมาย..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
              />
            </div>

            {/* Assignee */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">มอบหมายให้ <span className="text-red-400">*</span></label>
              <select
                value={formAssignee}
                onChange={(e) => setFormAssignee(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              >
                <option value="">-- เลือกพนักงาน --</option>
                {users.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email} {u.role === "STAFF" ? "(Staff)" : "(Admin)"}
                  </option>
                ))}
              </select>
              {users.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">ไม่พบพนักงานอื่นในระบบ</p>
              )}
            </div>

            {/* Due Date */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">กำหนดส่ง (ไม่บังคับ)</label>
              <input
                type="date"
                value={formDue}
                onChange={(e) => {
                  // convert YYYY-MM-DD → DD/MM/YYYY for display
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split("-");
                    setFormDue(`${d}/${m}/${y}`);
                  } else {
                    setFormDue("");
                  }
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              {formDue && <p className="text-xs text-slate-400 mt-1">กำหนดส่ง: {formDue}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formTitle.trim() || !formAssignee}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
              >
                {submitting ? "กำลังส่ง..." : "ส่งงาน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
