"use client";

import { useRouter } from "next/navigation";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import { PageHeader, QueryError } from "../../../../../../_components/PageElements";
import { PlatformPageContainer } from "../../../../../../_components/PlatformPageContainer";
import { PlatformBreadcrumbs } from "../../../../../../_components/PlatformBreadcrumbs";
import { useBuildingTenants } from "@/hooks/reactquery/platform";

export function BuildingTenantsList({ orgId, buildingId }: { orgId: number; buildingId: number }) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useBuildingTenants(buildingId);

  return (
    <PlatformPageContainer>
      <PlatformBreadcrumbs
        items={[
          { label: "조직 관리", href: "/platform-admin/organizations" },
          { label: data?.org.name ?? "조직", href: `/platform-admin/organizations/${orgId}` },
          { label: data?.building.name ?? "건물" },
        ]}
      />
      <PageHeader
        eyebrow="BUILDING"
        title={data?.building.name ?? "건물 상세"}
        description="이 건물의 입주민(세대) 목록입니다. 세대를 선택하면 상세를 조회합니다."
      />

      <section className="mt-6 rounded-2xl bg-surface shadow-card">
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
    </PlatformPageContainer>
  );
}
