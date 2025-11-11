import type { Metadata } from "next";
import { Orbitron, Noto_Sans_Thai } from "next/font/google";
import Providers from "./providers-wrapper";
import "./globals.css";

// ฟอนต์ภาษาอังกฤษ (Orbitron)
const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-orbitron", // ✅ ต้องมี เพื่อใช้ใน CSS variable
  display: "swap",
});

// ฟอนต์ภาษาไทย (Noto Sans Thai)
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fazzfly ERP",
  description: "Next-Gen Enterprise Resource Planning System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      // ✅ ต้องใช้ทั้ง variable + className เพื่อให้ var(--font-xxx) ทำงานได้
      className={`${orbitron.variable} ${orbitron.className} ${notoSansThai.variable} ${notoSansThai.className}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
