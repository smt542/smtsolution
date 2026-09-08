"use client";

import type { ReactNode } from "react";
import { Spinner } from "@/components/common";
import { PageHeader, QueryError } from "../../../../../../../../../_components/PageElements";
import { PlatformPageContainer } from "../../../../../../../../../_components/PlatformPageContainer";
import { PlatformBreadcrumbs } from "../../../../../../../../../_components/PlatformBreadcrumbs";
import { useUnitOccupancy } from "@/hooks/reactquery/platform";

const STATUS_LABEL: Record<string, string> = { occupied: "입주", vacant: "공실", moving_out: "이사예정" };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-t4">{label}</dt>
      <dd className="text-sm text-t1">{value === null || value === undefined || value === "" ? "-" : value}</dd>
    </div>
  );
}

export function UnitDetailView({ orgId, buildingId, unitId }: { orgId: number; buildingId: number; unitId: number }) {
  const { data, isPending, isError, refetch } = useUnitOccupancy(unitId);
  const o = data?.occupancy;

  return (
    <PlatformPageContainer maxWidthClassName="max-w-5xl">
      <PlatformBreadcrumbs
        items={[
          { label: "조직 관리", href: "/platform-admin/organizations" },
          { label: data?.orgName ?? "조직", href: `/platform-admin/organizations/${orgId}` },
          {
            label: data?.buildingName ?? "건물",
            href: `/platform-admin/organizations/${orgId}/buildings/${buildingId}`,
          },
          { label: data?.unitNo ?? "세대" },
        ]}
      />
      <PageHeader eyebrow="UNIT" title={data ? `${data.unitNo} 세대` : "세대 상세"} description="세대·입주 정보입니다. (읽기 전용)" />

      {isPending ? (
        <div className="py-16"><Spinner /></div>
      ) : isError ? (
        <div className="mt-6"><QueryError onRetry={() => void refetch()} /></div>
      ) : !data ? (
        <p className="mt-6 text-sm text-t3">세대를 찾을 수 없습니다.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-t2">세대 정보</h3>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="호실" value={data.unitNo} />
              <Field label="동" value={data.dong} />
              <Field label="면적(평)" value={data.areaPyeong} />
              <Field label="방 수" value={data.roomCount} />
            </dl>
          </section>
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-extrabold text-t2">입주 정보</h3>
            {o == null ? (
              <p className="text-sm text-t3">현재 입주 정보가 없습니다(공실).</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Field label="상태" value={STATUS_LABEL[o.status] ?? o.status} />
                <Field label="거주인원" value={o.residentCount} />
                <Field label="룸타입" value={o.roomTypeLabel} />
                <Field label="입주일" value={o.moveInDate} />
                <Field label="퇴거일" value={o.moveOutDate} />
              </dl>
            )}
          </section>
        </div>
      )}
    </PlatformPageContainer>
  );
}
