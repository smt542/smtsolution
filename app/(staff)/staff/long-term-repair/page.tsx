"use client";

import { Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { hasModule } from "@/lib/auth/permissions";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { LongTermRepairLedger } from "./components/LongTermRepairLedger";

export default function LongTermRepairPage() {
  const { data: me } = useMe();
  const { data: buildings = [], isLoading: buildingsLoading } = useBuildings();
  const { data: organizationName } = useBillOrganizationName(me?.orgId);

  if (me === undefined || buildingsLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>;
  }
  if (!me || !hasModule(me, "settings")) {
    return <div className="p-8 text-sm text-t2">이 화면에 접근할 권한이 없습니다. (장기수선비 관리 권한 필요)</div>;
  }

  return (
    <LongTermRepairLedger
      orgId={me.orgId}
      companyName={organizationName ?? PROGRAM_COMPANY_NAME}
      buildings={buildings.filter((building) => building.orgId === me.orgId)}
    />
  );
}
