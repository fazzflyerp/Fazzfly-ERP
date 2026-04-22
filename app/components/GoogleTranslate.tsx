"use client";

/**
 * GoogleTranslate — ปุ่ม TH/EN ลอยอยู่ทุกหน้า
 * ใช้ Google Translate Widget (ฟรี ไม่ต้องใช้ API Key)
 * inject script ครั้งเดียว ทำงานทุกหน้าอัตโนมัติ
 */

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google: any;
    googleTranslateElementInit: () => void;
  }
}

export default function GoogleTranslate() {
  const [lang, setLang] = useState<"th" | "en">("th");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // อ่านค่าภาษาจาก cookie
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("googtrans="));
    if (cookie && cookie.includes("/en")) setLang("en");

    // inject Google Translate script ถ้ายังไม่มี
    if (!document.getElementById("google-translate-script")) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "th",
            includedLanguages: "th,en",
            autoDisplay: false,
          },
          "google_translate_element"
        );
        setReady(true);
      };

      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else {
      setReady(true);
    }
  }, []);

  const switchLang = (target: "th" | "en") => {
    if (target === "th") {
      // ลบ cookie แล้ว reload เพื่อคืนข้อความต้นฉบับ
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname;
      window.location.reload();
      return;
    }

    // EN: trigger ผ่าน select ของ Google Translate widget
    const select = document.querySelector<HTMLSelectElement>(
      "#google_translate_element select"
    );
    if (!select) return;

    const option = Array.from(select.options).find((o) => o.value === "en");
    if (!option) return;

    select.value = "en";
    select.dispatchEvent(new Event("change"));
    setLang("en");
  };

  return (
    <>
      {/* Hidden Google Translate widget container */}
      <div id="google_translate_element" className="hidden" />

      {/* Hide Google's injected banner */}
      <style dangerouslySetInnerHTML={{ __html: `
        .goog-te-banner-frame, .skiptranslate { display: none !important; }
        body { top: 0 !important; }
        .goog-te-gadget { display: none !important; }
        .goog-logo-link { display: none !important; }
      `}} />

      {/* Language Toggle Button */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex rounded-2xl overflow-hidden shadow-2xl border border-white/20"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => switchLang("th")}
          disabled={!ready}
          className={`px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
            lang === "th"
              ? "bg-blue-600 text-white"
              : "bg-white/90 text-slate-500 hover:bg-slate-100"
          }`}
        >
          TH
        </button>
        <div className="w-px bg-slate-200" />
        <button
          onClick={() => switchLang("en")}
          disabled={!ready}
          className={`px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
            lang === "en"
              ? "bg-blue-600 text-white"
              : "bg-white/90 text-slate-500 hover:bg-slate-100"
          }`}
        >
          EN
        </button>
      </div>
    </>
  );
}
