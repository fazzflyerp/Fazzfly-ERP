/**
 * =============================================================================
 * FILE: app/context/UserRoleContext.tsx
 * =============================================================================
 * Global Role Context — โหลด role ของ user จาก /api/auth/user-role ครั้งเดียว
 * แล้ว expose ผ่าน useUserRole() hook ทุกหน้า
 *
 * Roles: SUPER_ADMIN | ADMIN | STAFF
 *
 * Usage:
 *   const { role, clientId, isAdmin, canEdit, loading } = useUserRole();
 *   if (!canEdit()) return null;
 */

"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "STAFF" | null;

interface UserRoleState {
  role: UserRole;
  clientId: string | null;
  loading: boolean;
  error: string | null;
  /** SUPER_ADMIN หรือ ADMIN */
  isAdmin: () => boolean;
  /** SUPER_ADMIN เท่านั้น */
  isSuperAdmin: () => boolean;
  /** ADMIN หรือ SUPER_ADMIN — แก้ไข/ลบ/ตั้งค่าได้ */
  canEdit: () => boolean;
  /** ทุก role ที่ login แล้ว — ดูข้อมูลได้ */
  canView: () => boolean;
  /** reload role จาก server (ใช้หลัง admin เปลี่ยน role) */
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UserRoleContext = createContext<UserRoleState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();

  const [role, setRole]       = useState<UserRole>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchRole = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/user-role");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        setRole(null);
        setClientId(null);
        return;
      }
      const data = await res.json();
      setRole((data.role as UserRole) ?? null);
      setClientId(data.clientId ?? null);

      // Auto-sync refresh token ของ Admin ลง sheet (fire & forget)
      if (data.role === "ADMIN" || data.role === "SUPER_ADMIN") {
        fetch("/api/auth/sync-drive-token", { method: "POST" }).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setRole(null);
      setClientId(null);
    } finally {
      setLoading(false);
    }
  };

  // โหลดเมื่อ session พร้อม
  useEffect(() => {
    if (status === "authenticated") {
      fetchRole();
    } else if (status === "unauthenticated") {
      setRole(null);
      setClientId(null);
      setLoading(false);
    }
    // status === "loading" → ยังรอ session ไม่ทำอะไร
  }, [status]);

  // ─── Permission helpers ──────────────────────────────────────────────────

  const isAdmin     = () => role === "ADMIN" || role === "SUPER_ADMIN";
  const isSuperAdmin = () => role === "SUPER_ADMIN";
  const canEdit     = () => role === "ADMIN" || role === "SUPER_ADMIN";
  const canView     = () => role !== null;

  return (
    <UserRoleContext.Provider
      value={{ role, clientId, loading, error, isAdmin, isSuperAdmin, canEdit, canView, refresh: fetchRole }}
    >
      {children}
    </UserRoleContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserRole(): UserRoleState {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error("useUserRole must be used within <UserRoleProvider>");
  }
  return ctx;
}
