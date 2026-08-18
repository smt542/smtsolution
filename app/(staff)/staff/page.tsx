import type { Metadata } from "next";
import { DashboardContent } from "./components/DashboardContent";

export const metadata: Metadata = { title: "대시보드 · 관리비서" };

export default function DashboardPage() {
  return <DashboardContent />;
}
