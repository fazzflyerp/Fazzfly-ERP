/**
 * TaskBell — กระดิ่งแจ้งเตือน Task
 * ใส่ใน navbar ของหน้าที่ต้องการ
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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

function statusBadge(status: string) {
  if (status === "done")    return { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-700" };
  if (status === "pending") return { label: "รอดำเนินการ", cls: "bg-amber-100 text-amber-700" };
  return { label: status, cls: "bg-gray-100 text-gray-600" };
}

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

export default function TaskBell() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTasks = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?mode=inbox");
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        setUnread(data.unreadCount || 0);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [session]);
  // poll ทุก 2 นาที
  useEffect(() => {
    const t = setInterval(fetchTasks, 120_000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => { setOpen(false); }, [pathname]);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const markRead = async (taskId: string) => {
    await fetch("/api/tasks/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, isRead: true }),
    });
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, isRead: true } : t));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const markDone = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/tasks/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status: "done", isRead: true }),
    });
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, status: "done", isRead: true } : t));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks    = tasks.filter((t) => t.status === "done");

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchTasks(); }}
        className="relative w-9 h-9 flex items-center justify-center bg-violet-600 rounded-xl shadow-sm hover:bg-violet-700 transition-all duration-200 active:scale-95"
        aria-label="Task Notifications"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">งานที่ได้รับมอบหมาย</span>
              {unread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                  {unread} ใหม่
                </span>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); router.push("/tasks"); }}
              className="text-xs text-violet-600 hover:text-violet-800 font-medium"
            >
              ดูทั้งหมด →
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
              </div>
            ) : pendingTasks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-sm text-slate-400">ไม่มีงานที่รอดำเนินการ</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {pendingTasks.slice(0, 8).map((task) => (
                  <div
                    key={task.taskId}
                    onClick={() => markRead(task.taskId)}
                    className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-default ${!task.isRead ? "bg-violet-50/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {!task.isRead && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                          <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                        </div>
                        <p className="text-xs text-slate-400 truncate">จาก: {task.assignerEmail}</p>
                        {task.dueDate && (
                          <p className={`text-xs mt-0.5 font-medium ${isDueSoon(task.dueDate) ? "text-red-500" : "text-slate-400"}`}>
                            {isDueSoon(task.dueDate) ? "⚠️ " : ""}กำหนด: {task.dueDate}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => markDone(task.taskId, e)}
                        className="flex-shrink-0 px-2 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        เสร็จ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {doneTasks.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">เสร็จแล้ว {doneTasks.length} งาน</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
