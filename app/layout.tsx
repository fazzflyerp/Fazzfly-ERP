import type { Metadata } from "next";
import Providers from "./providers-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poff Clinic",
  description: "Poff Clinic Management System",
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