"use client";

import { useRouter } from "next/navigation";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import { PageHeader, QueryError, StatusBadge } from "../../../../_components/PageElements";
import { PlatformPageContainer } from "../../../../_components/PlatformPageContainer";
import { PlatformBreadcrumbs } from "../../../../_components/PlatformBreadcrumbs";
import { useOrgBuildings } from "@/hooks/reactquery/platform";

export function OrgBuildingsList({ orgId }: { orgId: number }) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useOrgBuildings(orgId);

  return (
    <PlatformPageContainer>
      <PlatformBreadcrumbs
        items={[
          { label: "조직 관리", href: "/platform-admin/organizations" },
          { label: data?.org.name ?? "조직" },
        ]}
      />
      <PageHeader
        eyebrow="ORGANIZATION"
        title={data?.org.name ?? "조직 상세"}
        description="이 조직의 건물 목록입니다. 건물을 선택하면 입주민을 조회합니다."
      />
      {data?.org && <div className="mt-4"><StatusBadge status={data.org.status} /></div>}

      <section className="mt-6 rounded-2xl bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <h3 className="text-base font-extrabold text-t1">건물 목록{data ? ` · ${data.buildings.length}개` : ""}</h3>
        </div>
        {isPending ? (
          <div className="py-16" aria-label="불러오는 중"><Spinner /></div>
        ) : isError ? (
          <div className="p-4"><QueryError onRetry={() => void refetch()} /></div>
        ) : (data?.buildings.length ?? 0) === 0 ? (
          <EmptyState message="등록된 건물이 없습니다" />
        ) : (
          <DataTable
            columns={[
              { key: "code", label: "코드" },
              { key: "name", label: "건물명" },
              { key: "address", label: "주소" },
            ]}
            rows={(data?.buildings ?? []).map((b) => ({
              _id: b.id, code: b.code, name: b.name, address: b.address ?? "—",
            }))}
            onRowClick={(row) => router.push(`/platform-admin/organizations/${orgId}/buildings/${row._id}`)}
          />
        )}
      </section>
    </PlatformPageContainer>
  );
}
