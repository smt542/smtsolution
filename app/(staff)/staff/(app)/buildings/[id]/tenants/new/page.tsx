// app/(staff)/staff/buildings/[id]/tenants/new/page.tsx
import { hasModule } from "@/lib/auth/permissions";
import { TenantForm } from "../../components/TenantForm";
import { getStaffContext } from "../../../../_staffContext";

type TenantNewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TenantNewPage({ params }: TenantNewPageProps) {
  const [{ id }, me] = await Promise.all([params, getStaffContext()]);

  if (!hasModule(me, "tenants")) return <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (입주자 관리 권한 필요)</p>;

  return <TenantForm buildingId={Number(id)} />;
}
