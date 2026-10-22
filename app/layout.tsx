import type { Metadata } from "next";
import Providers from "./providers-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fazzfly ERP",
  description: "Fazzfly All-in-One Business System",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}