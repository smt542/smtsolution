import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = { title: "관리비서", description: "주택관리 ERP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
