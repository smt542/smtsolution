"use client";
import React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export default function BuildingDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = params.id;
  const base = `/staff/buildings/${id}`;
  const isTenants = pathname?.startsWith(`${base}/tenants`);

  // 건물정보(재설계 폼)는 자체 헤더를 가진 풀블리드 화면이라 탭/패딩 크롬 없이 렌더한다.
  if (!isTenants) return <>{children}</>;

  const tab = (href: string, active: boolean, label: string) => (
    <Link href={href} className={`h-10 rounded-xl px-4 text-sm font-bold leading-10 ${active ? "bg-brand text-white" : "bg-white text-t2 border border-line hover:bg-bg"}`}>{label}</Link>
  );
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex gap-2">
        {tab(base, false, "건물정보")}
        {tab(`${base}/tenants`, true, "입주자 관리")}
      </div>
      <div>{children}</div>
    </div>
  );
}
