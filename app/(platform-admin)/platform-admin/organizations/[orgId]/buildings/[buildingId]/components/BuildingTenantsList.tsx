"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import { PageHeader, QueryError } from "../../../../../../_components/PageElements";
import { useBuildingTenants } from "@/hooks/reactquery/platform";

export function BuildingTenantsList({ orgId, buildingId }: { orgId: number; buildingId: number }) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useBuildingTenants(buildingId);

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <nav className="mb-3 text-xs text-t3">
        <Link href="/platform-admin/organizations" className="hover:underline">조직 관리</Link>
        <span className="mx-1.5">›</span>
        <Link href={`/platform-admin/organizations/${orgId}`} className="hover:underline">{data?.org.name ?? "조직"}</Link>
        <span className="mx-1.5">›</span>
        {data?.building.name ?? "건물"}
      </nav>
      <PageHeader
        eyebrow="BUILDING"
        title={data?.building.name ?? "건물 상세"}
        description="이 건물의 입주민(세대) 목록입니다. 세대를 선택하면 상세를 조회합니다."
      />

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">입주민 목록{data ? ` · ${data.tenants.length}세대` : ""}</h3>
        </div>
        {isPending ? (
          <div className="py-16" aria-label="불러오는 중"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : (data?.tenants.length ?? 0) === 0 ? (
          <EmptyState message="등록된 세대가 없습니다" />
        ) : (
          <DataTable
            columns={[
              { key: "unitNo", label: "호실" },
              { key: "residents", label: "거주인원" },
              { key: "moveIn", label: "입주일" },
              { key: "vacancy", label: "상태" },
            ]}
            rows={(data?.tenants ?? []).map((t) => ({
              _id: t.unitId,
              unitNo: t.unitNo,
              residents: t.residentCount ?? "—",
              moveIn: t.moveInDate ?? "—",
              vacancy: t.isVacant ? "공실" : "입주",
            }))}
            onRowClick={(row) => router.push(`/platform-admin/organizations/${orgId}/buildings/${buildingId}/units/${row._id}`)}
          />
        )}
      </section>
    </div>
  );
}
