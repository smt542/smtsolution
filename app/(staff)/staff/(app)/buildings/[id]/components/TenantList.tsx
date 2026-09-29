"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Spinner, DataTable } from "@/components/common";
import { useTenantList } from "@/hooks/reactquery/occupancies";

export function TenantList({ buildingId }: { buildingId: number }) {
  const router = useRouter();
  const { data, isLoading, isError } = useTenantList(buildingId);
  const base = `/staff/buildings/${buildingId}/tenants`;
  const rows = (data ?? []).map((t) => ({
    _unitId: t.unitId,
    unitNo: t.unitNo,
    tenant: t.isVacant ? "공실" : (t.tenantName ?? "-"),
    roomType: t.roomTypeLabel ?? "-",
    resident: t.residentCount ?? "-",
    moveIn: t.moveInDate ?? "-",
    vacancy: t.isVacant ? "공실" : "입주",
    overdue: t.isOverdue ? "연체" : "-",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">입주자 관리</h2>
        <div className="flex gap-2">
          <a href={`/api/buildings/${buildingId}/tenant-cards`} className="inline-flex h-11 items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-t2 hover:bg-bg">입주자카드 출력</a>
          <Button variant="ghost" disabled title="관리비 부과 확정 후 사용 가능(P5)">관리비부과내역서</Button>
          <Button variant="primary" onClick={() => router.push(`${base}/new`)}>+ 호수·입주민 등록</Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isError ? (
        <EmptyState message="데이터를 불러오지 못했습니다. 다시 시도해 주세요." />
      ) : rows.length === 0 ? (
        <EmptyState message="등록된 세대가 없습니다." />
      ) : (
        // 공용 DataTable 기본형(통합관리자와 공유)은 배경이 없고 hover가 bg-bg라,
        // 여기서만 정본 표처럼 흰 배경 + 공통 hover 토큰으로 덮는다.
        <div className="[&>div]:bg-white [&_tbody_tr:hover_td]:bg-row-hover">
          <DataTable
            columns={[
              { key: "unitNo", label: "호실명" }, { key: "tenant", label: "입주자명" },
              { key: "roomType", label: "룸타입" }, { key: "resident", label: "인원" },
              { key: "moveIn", label: "입주일" }, { key: "vacancy", label: "공실여부" }, { key: "overdue", label: "연체여부" },
            ]}
            rows={rows}
            onRowDoubleClick={(r) => router.push(`${base}/${r._unitId}`)}
          />
        </div>
      )}
    </div>
  );
}
