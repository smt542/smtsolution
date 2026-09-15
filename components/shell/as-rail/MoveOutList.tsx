"use client";

import { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";

import { EmptyState, Spinner } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import type {
  StaffMoveOutFilters,
  StaffMoveOutRequest,
} from "@/hooks/reactquery/staffMoveOut/apis";
import { useConfirmMoveOut } from "@/hooks/reactquery/staffMoveOut/mutations";
import { useStaffMoveOutRequests } from "@/hooks/reactquery/staffMoveOut/queries";

import { FilterDropdown, type DdOption } from "./FilterDropdown";
import { MoveOutCard } from "./MoveOutCard";
import { MoveOutConfirmDialog } from "./MoveOutConfirmDialog";

type MoveOutSort = NonNullable<StaffMoveOutFilters["sort"]>;

const SORT_OPTIONS: DdOption[] = [
  { value: "created_desc", label: "신청일 최신순" },
  { value: "created_asc", label: "신청일 오래된순" },
  { value: "desired_asc", label: "희망일 빠른순" },
  { value: "desired_desc", label: "희망일 늦은순" },
];

export function MoveOutList() {
  const [buildingId, setBuildingId] = useState<number>();
  const [sort, setSort] = useState<MoveOutSort>("created_desc");
  const [selected, setSelected] = useState<StaffMoveOutRequest | null>(null);

  const { data: buildings = [] } = useBuildings();
  const moveOutQuery = useStaffMoveOutRequests({ buildingId, sort });
  const confirmMoveOut = useConfirmMoveOut();

  const buildingOptions = useMemo<DdOption[]>(
    () => [
      { value: "", label: "건물 전체" },
      ...buildings.map((building) => ({
        value: String(building.id),
        label: building.name,
        sub: building.address ?? undefined,
        code: building.code,
      })),
    ],
    [buildings],
  );

  const confirmSelected = () => {
    if (!selected) return;
    confirmMoveOut.mutate(selected.id, {
      onSuccess: () => {
        toast.success("퇴실 신청을 처리 완료했어요");
        setSelected(null);
      },
      onError: () => toast.error("퇴실 신청을 처리하지 못했어요"),
    });
  };

  return (
    <>
      <div className="flex gap-1.5 py-[10px] px-[14px] border-b border-line flex-wrap bg-white items-center">
        <FilterDropdown
          label="건물 선택"
          value={buildingId === undefined ? "" : String(buildingId)}
          options={buildingOptions}
          onChange={(value) => setBuildingId(value ? Number(value) : undefined)}
          searchable
          ariaLabel="퇴실 신청 건물 선택"
        />
        <FilterDropdown
          label="신청일 최신순"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => setSort(value as MoveOutSort)}
          ariaLabel="퇴실 신청 정렬"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-2 bg-white">
        {moveOutQuery.isLoading ? (
          <Spinner />
        ) : moveOutQuery.error ? (
          <EmptyState message="퇴실 신청을 불러오지 못했어요" />
        ) : (moveOutQuery.data ?? []).length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[13px] font-semibold text-t4">대기 중인 퇴실 신청이 없어요</div>
        ) : (
          moveOutQuery.data?.map((request) => (
            <MoveOutCard
              key={request.id}
              request={request}
              onDone={setSelected}
            />
          ))
        )}
      </div>
      <MoveOutConfirmDialog
        request={selected}
        onCancel={() => setSelected(null)}
        onConfirm={confirmSelected}
        pending={confirmMoveOut.isPending}
      />
    </>
  );
}
