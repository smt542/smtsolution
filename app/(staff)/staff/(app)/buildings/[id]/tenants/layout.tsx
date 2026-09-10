import type { ReactNode } from "react";
import Link from "next/link";

type TenantLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { id } = await params;
  const base = `/staff/buildings/${id}`;
  const tab = (href: string, active: boolean, label: string) => (
    <Link
      href={href}
      className={`h-10 rounded-xl px-4 text-sm font-bold leading-10 ${
        active ? "bg-brand text-white" : "bg-white text-t2 border border-line hover:bg-bg"
      }`}
    >
      {label}
    </Link>
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
