"use client";

import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { FeeItemManagement } from "./components/FeeItemManagement";

export default function FeeItemsPage() {
  const { data: me } = useMe();

  if (me === undefined) {
    return <div className="flex min-h-[420px] items-center justify-center"><Spinner /></div>;
  }
  if (!me || !hasModule(me, "fee_items")) {
    return <div className="p-6"><EmptyState message="권한이 없습니다" /></div>;
  }

  return <FeeItemManagement orgId={me.orgId} />;
}
