// app/(staff)/staff/buildings/[id]/tenants/new/page.tsx
import { hasModule } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/shell/PageHeader";
import { TenantForm } from "../../components/TenantForm";
import { getStaffContext } from "../../../../_staffContext";

type TenantNewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TenantNewPage({ params }: TenantNewPageProps) {
  const [{ id }, me] = await Promise.all([params, getStaffContext()]);

  // 이 라우트는 AppShell 이 전역 Topbar 를 숨기므로(hasIntegratedHeader), 권한 거부 화면도
  // 자체 헤더를 그려야 한다. 안 그리면 헤더 없는 맨 문장만 남는다.
  if (!hasModule(me, "tenants")) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <PageHeader breadcrumb="건물·입주자 관리" title="입주자 관리" />
        <div className="px-[24px] pt-[22px]">
          <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (입주자 관리 권한 필요)</p>
        </div>
      </div>
    );
  }

  return <TenantForm buildingId={Number(id)} />;
}
