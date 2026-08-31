"use client";

import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { CustomerNumberLookupContent } from "./components/CustomerNumberLookupContent";

export default function CustomerNumberLookupPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "utilities")) {
    return (
      <div className="p-6">
        <EmptyState message="고객번호 조회 권한이 없습니다" />
      </div>
    );
  }

  return <CustomerNumberLookupContent />;
}
