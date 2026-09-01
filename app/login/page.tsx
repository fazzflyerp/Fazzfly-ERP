//path: app/login/page.tsx
"use client";

import { useState } from 'react';
import { signIn } from "next-auth/react";
import Image from 'next/image';

export default function LoginPage() {
  const [mode,        setMode]        = useState<"google" | "email">("google");
  const [isLoading,   setIsLoading]   = useState(false);
  const [credLoading, setCredLoading] = useState(false);
  const [credEmail,   setCredEmail]   = useState("");
  const [credPass,    setCredPass]    = useState("");
  const [credError,   setCredError]   = useState("");
  const [showPass,    setShowPass]    = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/auth-router" });
  };

  const handleCredSignIn = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCredError("");
    setCredLoading(true);
    const res = await signIn("credentials", {
      email: credEmail.trim(),
      password: credPass,
      redirect: false,
    });
    setCredLoading(false);
    if (res?.error) {
      setCredError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } else {
      window.location.href = "/auth-router";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f9f6ef" }}>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Image src="/poff_logo_red.png" alt="Poff Clinic" width={160} height={64} className="object-contain" />
          </div>
          <p className="text-sm tracking-widest uppercase" style={{ color: "#999", letterSpacing: "0.18em" }}>Management System</p>
          <div className="mt-4 mx-auto w-10 h-px" style={{ background: "#990011" }} />
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 4px 32px rgba(153,0,17,0.08)" }}>

          {/* Tabs */}
          <div className="flex" style={{ borderBottom: "1px solid #f0e8e8" }}>
            <button
              onClick={() => { setMode("google"); setCredError(""); }}
              className="flex-1 py-3.5 text-xs font-semibold tracking-widest uppercase transition-all"
              style={{
                color: mode === "google" ? "#990011" : "#bbb",
                borderBottom: mode === "google" ? "2px solid #990011" : "2px solid transparent",
                background: "transparent",
              }}
            >
              Google
            </button>
            <button
              onClick={() => { setMode("email"); setCredError(""); }}
              className="flex-1 py-3.5 text-xs font-semibold tracking-widest uppercase transition-all"
              style={{
                color: mode === "email" ? "#990011" : "#bbb",
                borderBottom: mode === "email" ? "2px solid #990011" : "2px solid transparent",
                background: "transparent",
              }}
            >
              Email
            </button>
          </div>

          <div className="p-8">

            {/* Google sign-in */}
            {mode === "google" && (
              <div>
                <p className="text-sm mb-7 leading-relaxed text-center" style={{ color: "#888" }}>
                  เข้าสู่ระบบด้วย Google account<br/>ที่ได้รับอนุญาต
                </p>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "#990011" }}
                  onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#b3001f"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#990011"; }}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </>
                  ) : (
                    <>
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-4 h-4 bg-white rounded p-0.5" />
                      เข้าสู่ระบบด้วย Google
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Email / Password */}
            {mode === "email" && (
              <form onSubmit={handleCredSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs mb-1.5 tracking-wide" style={{ color: "#999" }}>Email</label>
                  <input
                    type="email"
                    placeholder="staff@poffclinic.com"
                    value={credEmail}
                    onChange={(e) => setCredEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-colors outline-none"
                    style={{ background: "#fff", border: "1px solid #ccc", color: "#1a1a1a" }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#990011")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#ccc")}
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1.5 tracking-wide" style={{ color: "#999" }}>Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={credPass}
                      onChange={(e) => setCredPass(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full px-4 py-3 rounded-xl text-sm transition-colors outline-none pr-10"
                      style={{ background: "#fff", border: "1px solid #ccc", color: "#1a1a1a" }}
                      onFocus={e => (e.currentTarget.style.borderColor = "#990011")}
                      onBlur={e => (e.currentTarget.style.borderColor = "#ccc")}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "#bbb" }}>
                      {showPass
                        ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {credError && (
                  <p className="text-xs flex items-center gap-1.5" style={{ color: "#990011" }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {credError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={credLoading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "#990011" }}
                  onMouseEnter={e => { if (!credLoading) (e.currentTarget as HTMLButtonElement).style.background = "#b3001f"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#990011"; }}
                >
                  {credLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        กำลังเข้าสู่ระบบ...
                      </span>
                    : "เข้าสู่ระบบ"
                  }
                </button>
              </form>
            )}

          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-8" style={{ color: "#ccc" }}>© 2025 Poff Clinic. All rights reserved.</p>

      </div>
    </div>
  );
}
