"use client";

/**
 * GoogleTranslate — inject script + hidden widget เท่านั้น
 * ปุ่ม TH/EN แยกไปอยู่ใน LangToggle
 */

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
    _gtReady: boolean;
  }
}

function readLangFromCookie(): "th" | "en" {
  if (typeof document === "undefined") return "th";
  const c = document.cookie.split("; ").find((c) => c.startsWith("googtrans="));
  return c && c.includes("/en") ? "en" : "th";
}

function setCookieAllDomains(value: string) {
  const h = window.location.hostname;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${h}`;
  document.cookie = `googtrans=${value}; path=/; domain=.${h}`;
}

function clearCookieAllDomains() {
  const exp = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
  const h = window.location.hostname;
  document.cookie = `googtrans=; ${exp}; path=/`;
  document.cookie = `googtrans=; ${exp}; path=/; domain=${h}`;
  document.cookie = `googtrans=; ${exp}; path=/; domain=.${h}`;
}

export function switchLang(target: "th" | "en") {
  const current = readLangFromCookie(); // อ่านจาก cookie จริงๆ ไม่ใช่ stale variable
  if (target === current) return;
  if (target === "th") {
    clearCookieAllDomains();
  } else {
    setCookieAllDomains("/th/en");
  }
  window.location.reload();
}

// ── Script injector (mount once in layout) ───────────────────────────────────
export default function GoogleTranslate() {
  useEffect(() => {
    if (!document.getElementById("google-translate-script")) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: "th", includedLanguages: "th,en", autoDisplay: false },
          "google_translate_element"
        );
        window._gtReady = true;
      };
      const s = document.createElement("script");
      s.id = "google-translate-script";
      s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  return (
    <>
      <div id="google_translate_element" className="hidden" />
      <style dangerouslySetInnerHTML={{ __html: `
        .goog-te-banner-frame, .skiptranslate { display: none !important; }
        body { top: 0 !important; }
        .goog-te-gadget { display: none !important; }
        .goog-logo-link { display: none !important; }
      `}} />
    </>
  );
}

// ── Inline toggle — ใส่ใน navbar ─────────────────────────────────────────────
export function LangToggle({ className = "" }: { className?: string }) {
  const [lang, setLang] = useState<"th" | "en">("th");

  useEffect(() => {
    setLang(readLangFromCookie());
  }, []);

  return (
    <div className={`flex rounded-xl overflow-hidden border border-slate-200 bg-white/80 shadow-sm ${className}`}>
      <button
        onClick={() => switchLang("th")}
        className={`px-2.5 py-1 text-xs font-bold transition-all ${
          lang === "th" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        TH
      </button>
      <div className="w-px bg-slate-200" />
      <button
        onClick={() => switchLang("en")}
        className={`px-2.5 py-1 text-xs font-bold transition-all ${
          lang === "en" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        EN
      </button>
    </div>
  );
}
