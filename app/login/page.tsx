//path: app/login/page.tsx
"use client";

import { useState } from 'react';
import { signIn } from "next-auth/react";
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const [mode,        setMode]        = useState<"normal" | "demo">("normal");
  const [isHovered,   setIsHovered]   = useState(false);
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-sky-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Home Button */}
      <Link href="/">
        <button className="fixed top-6 left-6 z-50 inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-xl border border-blue-100 rounded-xl hover:bg-white hover:shadow-lg transition-all duration-300 text-blue-600 font-medium">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          กลับหน้าหลัก
        </button>
      </Link>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8 animate-slideDown">
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Image src="/logo2.png" alt="Fazzfly Logo" width={80} height={80} className="object-contain" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent mb-2">
              Fazzfly Platform
            </h1>
            <p className="text-slate-500 text-sm">Enterprise Business Solutions</p>
          </div>

          {/* Card */}
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-blue-200/50 border border-blue-100/50 overflow-hidden animate-slideDown" style={{ animationDelay: '100ms' }}>

            {/* Tab Toggle */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => { setMode("normal"); setCredError(""); }}
                className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === "normal"
                    ? "text-blue-600 border-b-2 border-blue-500 bg-blue-50/50"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                เข้าสู่ระบบ
              </button>
              <button
                onClick={() => { setMode("demo"); setCredError(""); }}
                className={`flex-1 py-4 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  mode === "demo"
                    ? "text-violet-600 border-b-2 border-violet-500 bg-violet-50/50"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Demo
              </button>
            </div>

            <div className="p-8">

              {/* ── Normal mode: Google ─────────────────────────────────── */}
              {mode === "normal" && (
                <div>
                  <div className="mb-7">
                    <h2 className="text-2xl font-bold text-slate-800 mb-1">ยินดีต้อนรับ</h2>
                    <p className="text-slate-500 text-sm">เข้าสู่ระบบเพื่อจัดการธุรกิจของคุณ</p>
                  </div>

                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="w-full relative group mb-6"
                  >
                    <div className={`
                      w-full flex items-center justify-center gap-3
                      bg-gradient-to-br from-blue-600 to-cyan-500
                      text-white py-4 rounded-2xl
                      transition-all duration-300 font-semibold text-base
                      ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}
                      ${isHovered ? 'shadow-xl shadow-blue-500/40 -translate-y-0.5' : 'shadow-lg shadow-blue-500/20'}
                    `}>
                      {isLoading ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          กำลังเข้าสู่ระบบ...
                        </>
                      ) : (
                        <>
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5 bg-white rounded-md p-0.5" />
                          เข้าสู่ระบบด้วย Google
                        </>
                      )}
                    </div>
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 transition-opacity duration-300 -z-10 blur-lg ${isHovered ? 'opacity-50' : 'opacity-0'}`} />
                  </button>

                  {/* Security Features */}
                  <div className="space-y-2.5">
                    {[
                      { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", text: "เข้ารหัสข้อมูลระดับ Enterprise", color: "text-blue-600" },
                      { icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", text: "เชื่อมต่อ Google Sheets โดยตรง", color: "text-sky-600" },
                      { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", text: "ไม่เก็บข้อมูลบนเซิร์ฟเวอร์ภายนอก", color: "text-cyan-600" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm text-slate-700 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl px-4 py-3 border border-blue-100/60">
                        <div className="flex-shrink-0 p-1.5 bg-white rounded-lg shadow-sm">
                          <svg className={`w-4 h-4 ${item.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                          </svg>
                        </div>
                        <span className="font-medium text-xs">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Demo mode: Email + Password ─────────────────────────── */}
              {mode === "demo" && (
                <div>
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
                      style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "#7c3aed" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                      Demo Account
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-1">ทดลองใช้งาน</h2>
                    <p className="text-slate-500 text-sm">เข้าสู่ระบบด้วย Demo account ที่ได้รับ</p>
                  </div>

                  <form onSubmit={handleCredSignIn} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Email</label>
                      <input
                        type="email"
                        placeholder="demo@fazzfly.com"
                        value={credEmail}
                        onChange={(e) => setCredEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="w-full px-4 py-3 rounded-2xl text-sm border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          placeholder="••••••••"
                          value={credPass}
                          onChange={(e) => setCredPass(e.target.value)}
                          required
                          autoComplete="current-password"
                          className="w-full px-4 py-3 rounded-2xl text-sm border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all pr-11"
                        />
                        <button type="button" onClick={() => setShowPass((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                          {showPass
                            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          }
                        </button>
                      </div>
                    </div>

                    {credError && (
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-100">
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-500 text-xs font-medium">{credError}</p>
                      </div>
                    )}

                    <button type="submit" disabled={credLoading}
                      className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}>
                      {credLoading
                        ? <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            กำลังเข้าสู่ระบบ...
                          </span>
                        : "เข้าสู่ระบบ Demo"
                      }
                    </button>
                  </form>

                  {/* Demo note */}
                  <div className="mt-5 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-xs text-amber-700 font-medium flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Demo account สำหรับทดสอบระบบเท่านั้น ข้อมูลที่แสดงเป็นข้อมูลตัวอย่าง
                    </p>
                  </div>

                  {/* Request demo link */}
                  <div className="mt-4 text-center">
                    <p className="text-xs text-slate-400 mb-2">ยังไม่มี Demo account?</p>
                    <button onClick={() => { window.location.href = "/#register"; }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors group">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                      </svg>
                      ขอทดลองใช้งานฟรี
                      <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 animate-slideDown" style={{ animationDelay: '300ms' }}>
            <p className="text-xs text-slate-500">© 2025 Fazzfly Platform. All rights reserved.</p>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -50px) scale(1.1); }
          66%       { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-blob          { animation: blob 7s infinite; }
        .animation-delay-2000  { animation-delay: 2s; }
        .animation-delay-4000  { animation-delay: 4s; }
        .animate-slideDown     { animation: slideDown 0.5s ease-out both; }
      `}</style>
    </div>
  );
}
