"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Annotation {
  id: number;
  x: string;
  y: string;
  label: string;
  side?: "left" | "right";
}

interface BuiltUrls {
  login:   string;
  home:    string;
  erpHome: string;
  sales:   string | null;
  crm:     string | null;
  finance: string | null;
  receipt: string | null;
}

/* ─── Annotated iframe ───────────────────────────────────────────────── */
const IFRAME_W = 1440;
const SCALE    = 0.58;

function DraggableDot({
  ann, containerRef, editMode,
  pos, onMove,
}: {
  ann: Annotation;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editMode: boolean;
  pos: { x: number; y: number };
  onMove: (x: number, y: number) => void;
}) {
  const dragging = React.useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    dragging.current = true;

    const move = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.round(((ev.clientX - rect.left) / rect.width)  * 100);
      const y = Math.round(((ev.clientY - rect.top)  / rect.height) * 100);
      onMove(Math.max(2, Math.min(98, x)), Math.max(2, Math.min(98, y)));
    };
    const up = () => { dragging.current = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      style={{ position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)", zIndex: 20, cursor: editMode ? "grab" : "default", userSelect: "none" }}
    >
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: editMode ? "#f59e0b" : "#ff4757", color: "#fff", fontWeight: 900, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff", boxShadow: `0 0 0 3px ${editMode ? "rgba(245,158,11,0.4)" : "rgba(255,71,87,0.35)"}`, animation: editMode ? "none" : "pulse 2s infinite" }}>
        {ann.id}
      </div>
      {editMode && (
        <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "#fff", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
          {pos.x}%, {pos.y}%
        </div>
      )}
    </div>
  );
}

function AnnotatedFrame({
  src, height, annotations, showAnnotations, editMode, storageKey,
}: {
  src: string; height: number; annotations: Annotation[]; showAnnotations: boolean; editMode: boolean; storageKey: string;
}) {
  const BAR_H   = 28;
  const innerH  = height - BAR_H;
  const iframeH = Math.round(innerH / SCALE);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const initPos = (ann: Annotation) => ({
    x: parseFloat(ann.x),
    y: parseFloat(ann.y),
  });
  const [positions, setPositions] = React.useState<{x:number;y:number}[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`training_pos_${storageKey}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return annotations.map(initPos);
  });

  const move = (i: number, x: number, y: number) =>
    setPositions(prev => {
      const next = prev.map((p, idx) => idx === i ? { x, y } : p);
      try { localStorage.setItem(`training_pos_${storageKey}`, JSON.stringify(next)); } catch {}
      return next;
    });

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height, borderRadius: 12, overflow: "hidden", border: `2px solid ${editMode ? "#f59e0b" : "#dce7ff"}`, boxShadow: "0 4px 24px rgba(27,44,94,0.10)" }}>

      {/* browser bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAR_H, background: "#1b2c5e", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", zIndex: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        <span style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 16, marginLeft: 8, fontSize: 10, color: "rgba(255,255,255,0.5)", padding: "0 8px", display: "flex", alignItems: "center" }}>{src}</span>
        {editMode && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginLeft: 4 }}>✏️ EDIT MODE — ลากจุดได้</span>}
      </div>

      {/* iframe */}
      <div style={{ position: "absolute", top: BAR_H, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
        <iframe
          src={src}
          style={{ width: IFRAME_W, height: iframeH, border: "none", display: "block", transform: `scale(${SCALE})`, transformOrigin: "top left", pointerEvents: (showAnnotations || editMode) ? "none" : "auto" }}
          title="preview"
        />
      </div>

      {/* draggable dots */}
      {showAnnotations && annotations.map((ann, i) => (
        <DraggableDot
          key={ann.id}
          ann={ann}
          containerRef={containerRef}
          editMode={editMode}
          pos={positions[i]}
          onMove={(x, y) => move(i, x, y)}
        />
      ))}
    </div>
  );
}

function Placeholder({ height, msg }: { height: number; msg: string }) {
  return (
    <div style={{ height, borderRadius: 12, border: "2px dashed #b0c8fc", background: "#f0f5ff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#8aa4d8", fontFamily: "'Sarabun','Noto Sans Thai',sans-serif" }}>
      <div style={{ fontSize: 32 }}>⏳</div>
      <div style={{ fontSize: 13 }}>{msg}</div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */
function TrainingContent() {
  const { data: session, status } = useSession();
  const [urls, setUrls]           = useState<BuiltUrls | null>(null);
  const [fetchErr, setFetchErr]   = useState<string | null>(null);
  const [showAnn, setShowAnn]     = useState(true);
  const [editMode, setEditMode]   = useState(false);
  const [active, setActive]       = useState("intro");

  /* fetch modules → build iframe URLs */
  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch("/api/user/modules-demo").then(r => r.json()),
      fetch("/api/auth/branch-check").then(r => r.json()).catch(() => ({})),
    ]).then(([mods]) => {
      const clientId: string = mods.clientId || "";
      const modules: any[]   = mods.modules  || [];

      const salesMod   = modules.find((m: any) => { const n = (m.moduleName||"").toUpperCase(); return n.includes("SALE") || n.includes("RENTAL"); });
      const financeMod = modules.find((m: any) => { const n = (m.moduleName||"").toUpperCase(); return n.includes("FINANCE") || n.includes("FINANC"); });
      const crmMod     = modules.find((m: any) => { const n = (m.configName||"").toUpperCase(); return n.includes("CRM") || n.includes("APT"); });

      const built: BuiltUrls = {
        login:   "/shared/auth-router",
        home:    "/select-system-demo",
        erpHome: "/ERP/home-demo",
        sales:   salesMod
          ? `/ERP/form-demo?moduleId=${salesMod.moduleId}&spreadsheetId=${salesMod.spreadsheetId}&configName=${encodeURIComponent(salesMod.configName)}&sheetName=${encodeURIComponent(salesMod.sheetName)}`
          : null,
        finance: salesMod
          ? `/ERP/finance?spreadsheetId=${salesMod.spreadsheetId}`
          : null,
        crm: crmMod
          ? `/ERP/crm?spreadsheetId=${crmMod.spreadsheetId}&aptSheet=${encodeURIComponent(crmMod.sheetName||"appointments")}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ""}`
          : null,
        receipt: salesMod
          ? `/ERP/receipt?spreadsheetId=${salesMod.spreadsheetId}`
          : null,
      };

      setUrls(built);
    }).catch(e => setFetchErr(e.message));
  }, [session]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  const navItems = [
    { section: "เริ่มต้น", items: [{ id: "intro", icon: "📖", label: "ภาพรวม" }, { id: "home", icon: "🏠", label: "System Select" }, { id: "erphome", icon: "📋", label: "ERP Home" }] },
    { section: "โมดูล",   items: [{ id: "sales", icon: "🧾", label: "บันทึกขาย" }, { id: "crm", icon: "👥", label: "CRM" }, { id: "finance", icon: "📊", label: "Finance" }, { id: "receipt", icon: "🖨️", label: "ใบเสร็จ" }] },
  ];

  type ChapterDef = {
    id: string; icon: string; title: string; desc: string;
    src: string | null | undefined; height: number; annotations: Annotation[];
    tips?: string[]; warnings?: string[];
  };

  const chapters: ChapterDef[] = [
    {
      id: "home", icon: "🏠", title: "หน้าหลัก (System Select)",
      desc: "หลัง Login จะเห็นระบบทั้งหมดที่มีสิทธิ์ใช้งาน กดเลือกได้เลย",
      src: urls?.home, height: 600,
      annotations: [
        { id: 1, x: "25%", y: "60%", label: "① คลิก ERP เข้าระบบ" },
        { id: 2, x: "50%", y: "60%", label: "② คลิก CRM ดูลูกค้า" },
        { id: 3, x: "75%", y: "60%", label: "③ คลิก Training คู่มือ" },
        { id: 4, x: "90%", y: "8%",  label: "④ ออกจากระบบ", side: "left" },
      ],
      tips: ["เลือกสาขาก่อนเข้าใช้งาน ERP"],
    },
    {
      id: "erphome", icon: "📋", title: "หน้า ERP (Module Select)",
      desc: "หลังเลือก ERP จะเห็น module ทั้งหมด เลือก module ที่ต้องการใช้งานได้เลย",
      src: urls?.erpHome, height: 600,
      annotations: [
        { id: 1, x: "25%", y: "55%", label: "① เลือก module การขาย" },
        { id: 2, x: "50%", y: "55%", label: "② เลือก module CRM" },
        { id: 3, x: "75%", y: "55%", label: "③ เลือก module รายงาน" },
        { id: 4, x: "50%", y: "20%", label: "④ เลือกสาขา", side: "left" },
      ],
    },
    {
      id: "sales", icon: "🧾", title: "บันทึกการขาย (Sales Form)",
      desc: "บันทึกรายการขายประจำวัน เลือกสินค้า กรอกจำนวน และช่องทางชำระเงิน",
      src: urls?.sales, height: 700,
      annotations: [
        { id: 1, x: "20%", y: "13%", label: "① เลือกวันที่" },
        { id: 2, x: "60%", y: "13%", label: "② กรอกชื่อลูกค้า" },
        { id: 3, x: "50%", y: "40%", label: "③ เพิ่มรายการสินค้า" },
        { id: 4, x: "50%", y: "68%", label: "④ เลือกช่องทางชำระ" },
        { id: 5, x: "80%", y: "88%", label: "⑤ กดบันทึก", side: "left" },
      ],
      tips: ["ราคารวมคำนวณให้อัตโนมัติ"],
      warnings: ["กดบันทึกแล้วหน้าค้าง รอ 3-5 วิ อย่ากดซ้ำ"],
    },
    {
      id: "crm", icon: "👥", title: "ข้อมูลลูกค้า (CRM)",
      desc: "ค้นหาลูกค้า ดูประวัติการรักษา ยอดสะสม และนัดหมาย",
      src: urls?.crm, height: 640,
      annotations: [
        { id: 1, x: "50%", y: "16%", label: "① ค้นหาชื่อหรือเบอร์โทร" },
        { id: 2, x: "30%", y: "45%", label: "② คลิกชื่อดูรายละเอียด" },
        { id: 3, x: "50%", y: "72%", label: "③ แท็บประวัติการซื้อ" },
      ],
    },
    {
      id: "finance", icon: "📊", title: "รายงานการเงิน (Finance)",
      desc: "ดูยอดรายได้ ค่าใช้จ่าย และกำไรขาดทุนรายเดือน",
      src: urls?.finance, height: 660,
      annotations: [
        { id: 1, x: "20%", y: "12%", label: "① เลือกปีที่ต้องการ" },
        { id: 2, x: "50%", y: "24%", label: "② KPI รายได้ / ค่าใช้จ่าย / กำไร" },
        { id: 3, x: "50%", y: "62%", label: "③ กราฟแนวโน้มรายเดือน" },
      ],
      tips: ["ข้อมูลอัปเดตอัตโนมัติหลังบันทึกขาย"],
    },
    {
      id: "receipt", icon: "🖨️", title: "ใบเสร็จรับเงิน",
      desc: "พิมพ์ใบเสร็จให้ลูกค้าหลังบันทึกการขาย",
      src: urls?.receipt, height: 540,
      annotations: [
        { id: 1, x: "50%", y: "22%", label: "① ตรวจสอบรายการสินค้า" },
        { id: 2, x: "50%", y: "76%", label: "② กดพิมพ์" },
      ],
      warnings: ["ตั้งค่ากระดาษ A4 และปิด Header/Footer ในเบราว์เซอร์"],
    },
  ];

  if (status === "loading" || (session && !urls && !fetchErr)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'Sarabun','Noto Sans Thai',sans-serif", color: "#4a8af4", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #dce7ff", borderTopColor: "#4a8af4", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div>กำลังโหลดข้อมูล...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Sarabun','Noto Sans Thai','Segoe UI',system-ui,sans-serif", background: "#f0f5ff", color: "#0d1b35" }}>
      <style>{`
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,71,87,0.5)} 50%{box-shadow:0 0 0 8px rgba(255,71,87,0)} }
        .nv { display:flex;align-items:center;gap:8px;padding:9px 20px;color:#c5d4f5;font-size:13.5px;font-weight:500;border-left:3px solid transparent;cursor:pointer;transition:all .15s; }
        .nv:hover { background:rgba(74,138,244,0.12);color:#fff; }
        .nv.on { border-left-color:#4a8af4;color:#fff;background:rgba(74,138,244,0.18); }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 220, minWidth: 220, background: "#1b2c5e", position: "sticky", top: 0, height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px 0 40px" }}>
        <div style={{ padding: "0 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>FazzFly ERP</div>
          <div style={{ fontSize: 11, color: "#8aa4d8", marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>คู่มือการใช้งาน</div>

          {/* toggles — อยู่ใต้โลโก้เสมอ ไม่หายหลัง refresh */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div onClick={() => setShowAnn(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <div style={{ width: 32, height: 18, borderRadius: 9, background: showAnn ? "#4a8af4" : "rgba(255,255,255,0.15)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: showAnn ? 16 : 2, transition: "left .2s" }} />
              </div>
              <span style={{ fontSize: 12, color: "#c5d4f5" }}>แสดงคำอธิบาย</span>
            </div>
            <div onClick={() => setEditMode(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <div style={{ width: 32, height: 18, borderRadius: 9, background: editMode ? "#f59e0b" : "rgba(255,255,255,0.15)", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: editMode ? 16 : 2, transition: "left .2s" }} />
              </div>
              <span style={{ fontSize: 12, color: editMode ? "#f59e0b" : "#c5d4f5" }}>✏️ ลากจุด</span>
            </div>
          </div>
        </div>

        {navItems.map(sec => (
          <div key={sec.section}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(197,212,245,0.4)", padding: "12px 20px 4px" }}>{sec.section}</div>
            {sec.items.map(it => (
              <div key={it.id} className={`nv${active === it.id ? " on" : ""}`} onClick={() => scrollTo(it.id)}>
                <span>{it.icon}</span>{it.label}
              </div>
            ))}
          </div>
        ))}

      </aside>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 1100, padding: "40px 40px 80px", overflowX: "hidden" }}>

        {/* Hero */}
        <div style={{ background: "linear-gradient(135deg,#1b2c5e 0%,#2d4a96 60%,#4a8af4 100%)", borderRadius: 16, padding: "32px 40px", marginBottom: 48 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Training Manual · v1.0</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1.2, margin: "0 0 10px" }}>คู่มือการใช้งาน<br />FazzFly ERP</h1>
          <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 14 }}>เรียนรู้ทีละขั้นตอนพร้อมหน้าจอจริง · สลับ toggle เพื่อกดลองได้เลย</div>
          {fetchErr && (
            <div style={{ marginTop: 14, background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#ffaaaa" }}>
              ⚠️ โหลด modules ไม่สำเร็จ: {fetchErr}
            </div>
          )}
        </div>

        {/* Intro */}
        <section id="intro" style={{ marginBottom: 52, scrollMarginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4a8af4", marginBottom: 6 }}>บทที่ 1</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px" }}>ภาพรวมระบบ FazzFly</h2>
          <p style={{ color: "#5a6a8a", fontSize: 14, marginBottom: 22 }}>ระบบบริหารจัดการธุรกิจใช้งานผ่านเบราว์เซอร์ ไม่ต้องติดตั้ง ข้อมูลเก็บใน Google Sheets</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>{["โมดูล","ทำอะไรได้","ใครใช้"].map(h => <th key={h} style={{ background:"#1b2c5e",color:"#fff",padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700 }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[
                  ["🧾 Sales","บันทึกการขาย ออกบิล เลือกสินค้าจาก dropdown","พนักงานขาย"],
                  ["👥 CRM","ดูข้อมูลลูกค้า ประวัติ ยอดสะสม","พนักงานขาย"],
                  ["📊 Finance","รายงาน P&L ยอดรายได้ ค่าใช้จ่ายรายเดือน","ผู้จัดการ"],
                  ["🖨️ ใบเสร็จ","พิมพ์ใบเสร็จรับเงินให้ลูกค้า","พนักงานขาย"],
                ].map(([m,d,w],i) => (
                  <tr key={i}>
                    <td style={{ padding:"10px 14px",borderBottom:"1px solid #dce7ff",fontWeight:600,background:i%2?"#f4f8ff":undefined }}>{m}</td>
                    <td style={{ padding:"10px 14px",borderBottom:"1px solid #dce7ff",color:"#5a6a8a",background:i%2?"#f4f8ff":undefined }}>{d}</td>
                    <td style={{ padding:"10px 14px",borderBottom:"1px solid #dce7ff",background:i%2?"#f4f8ff":undefined }}>
                      <span style={{ background:"#e8f0fe",color:"#4a8af4",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700 }}>{w}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Dynamic chapters */}
        {chapters.map((ch, idx) => (
          <section key={ch.id} id={ch.id} style={{ marginBottom: 52, scrollMarginTop: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4a8af4", marginBottom: 6 }}>บทที่ {idx + 2}</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>{ch.icon} {ch.title}</h2>
            <p style={{ color: "#5a6a8a", fontSize: 14, marginBottom: 18 }}>{ch.desc}</p>
            <div style={{ height: 1, background: "#dce7ff", marginBottom: 20 }} />

            {/* iframe — เต็มความกว้าง */}
            {ch.src
              ? <AnnotatedFrame src={ch.src} height={ch.height} annotations={ch.annotations} showAnnotations={showAnn} editMode={editMode} storageKey={ch.id} />
              : <Placeholder height={ch.height} msg="กำลังโหลดข้อมูล module..." />
            }

            {/* คำอธิบายแถวด้านล่าง */}
            {showAnn && ch.annotations.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                {ch.annotations.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #dce7ff", borderRadius: 20, padding: "5px 14px 5px 5px", boxShadow: "0 1px 4px rgba(27,44,94,0.07)" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#ff4757", color: "#fff", fontWeight: 900, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {a.id}
                    </div>
                    <span style={{ fontSize: 13, color: "#0d1b35", fontWeight: 500 }}>{a.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* tips / warnings */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {ch.tips?.map((t, i) => (
                <div key={i} style={{ background: "#e6f9f0", borderLeft: "3px solid #34c97a", borderRadius: 8, padding: "9px 14px", fontSize: 13, flex: "1 1 240px" }}>
                  💡 {t}
                </div>
              ))}
              {ch.warnings?.map((w, i) => (
                <div key={i} style={{ background: "#fff7e0", borderLeft: "3px solid #f5a623", borderRadius: 8, padding: "9px 14px", fontSize: 13, flex: "1 1 240px" }}>
                  ⚠️ {w}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* FAQ */}
        <section id="faq" style={{ scrollMarginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#4a8af4", marginBottom: 6 }}>บทสุดท้าย</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>❓ คำถามที่พบบ่อย</h2>
          <div style={{ height: 1, background: "#dce7ff", margin: "16px 0" }} />
          {[
            ["ข้อมูลไม่แสดงหรือโหลดนาน?","รีเฟรชหน้าเว็บ (F5) แล้วรอ 5-10 วินาที ระบบดึงข้อมูลจาก Google Sheets อาจใช้เวลาเล็กน้อย"],
            ["กดบันทึกแล้วเกิดข้อผิดพลาด?","จับภาพหน้าจอส่งผู้ดูแลระบบ ห้ามกดบันทึกซ้ำ"],
            ["สินค้าไม่อยู่ใน dropdown?","ติดต่อผู้ดูแลระบบให้เพิ่มสินค้า"],
            ["ลืมรหัสผ่าน?","ติดต่อผู้ดูแลระบบ จะ reset ให้ภายใน 24 ชม."],
            ["ใบเสร็จพิมพ์แล้วตัด?","ตั้ง Scale เป็น Fit to page และเลือกกระดาษ A4"],
          ].map(([q,a],i) => (
            <div key={i} style={{ borderBottom:"1px solid #dce7ff",padding:"16px 0" }}>
              <div style={{ fontWeight:700,fontSize:14.5,marginBottom:6,display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:22,height:22,borderRadius:"50%",background:"#e8f0fe",color:"#4a8af4",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>?</div>
                {q}
              </div>
              <div style={{ fontSize:13.5,color:"#5a6a8a",paddingLeft:32 }}>{a}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"sans-serif",color:"#4a8af4" }}>กำลังโหลด...</div>}>
      <TrainingContent />
    </Suspense>
  );
}
