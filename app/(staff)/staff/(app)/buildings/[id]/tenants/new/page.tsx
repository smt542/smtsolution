// app/(staff)/staff/buildings/[id]/tenants/new/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { TenantForm } from "../../components/TenantForm";

export default function TenantNewPage() {
  const { data: me } = useMe();
  const params = useParams<{ id: string }>();
  const buildingId = Number(params.id);
  if (me === undefined) return null;
  if (!hasModule(me, "tenants")) return <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (입주자 관리 권한 필요)</p>;
  return <TenantForm buildingId={buildingId} />;
}
