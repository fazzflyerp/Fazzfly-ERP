import type { Metadata } from "next";
import { 
  Kanit, 
  Archivo_Black, 
  Roboto, 
  Noto_Sans_Thai,
  Poppins 
} from "next/font/google";
import Providers from "./providers-wrapper";
import "./globals.css";

// ฟอนต์ไทย Noto Sans Thai (Default) - ใช้ variable --font-kanit เพื่อให้ทำงานกับ CSS เดิม
const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-kanit", // ✅ ใช้ชื่อเดิม --font-kanit เพื่อไม่ต้องแก้ CSS
  display: "swap",
});

// ฟอนต์ไทย Kanit (สำรอง - ถ้าต้องการใช้)
const kanit = Kanit({
  subsets: ["thai"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-kanit-alt", // เปลี่ยนเป็นชื่ออื่น
  display: "swap",
});

// ฟอนต์อังกฤษ Roboto
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap",
});

// ฟอนต์อังกฤษ Archivo Black
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
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
      className={`${notoSansThai.variable} ${notoSansThai.className} ${archivoBlack.variable} ${archivoBlack.className}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}