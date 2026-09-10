import { redirect } from "next/navigation";

// 협력업체 관리는 PRD 정본상 /setup 시스템설정 탭 소속 → 이관 완료. 이 라우트는 리다이렉트만 유지.
export default function VendorManagementRedirect() {
  redirect("/staff/setup?tab=system");
}
