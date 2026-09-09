import type { Metadata } from "next";
import { QueryProvider } from "@/lib/providers";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "관리비서", description: "주택관리 ERP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster
          position="bottom-center"
          offset="32px"
          toastOptions={{
            style: {
              background: "#191F28",
              color: "#fff",
              border: "none",
              fontSize: "14px",
              fontWeight: 700,
              padding: "12px 20px",
              borderRadius: "12px",
              boxShadow: "0 12px 30px -8px rgba(0,0,0,0.4)",
            },
            classNames: { icon: "hidden" },
          }}
        />
      </body>
    </html>
  );
}
