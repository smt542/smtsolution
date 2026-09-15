"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, Spinner } from "@/components/common";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useComplaints,
  type ComplaintStatus,
} from "@/hooks/reactquery/complaints";

import { AsReceptionCard } from "./AsReceptionCard";
import {
  FilterDropdown,
  MultiFilterDropdown,
  type DdOption,
} from "./FilterDropdown";
import { AS_STATUS_LABEL } from "./constants";

interface AsReceptionListProps {
  refreshSignal?: number;
}

const STATUS_OPTIONS: DdOption[] = [
  { value: "", label: "결과 전체" },
  { value: "pending", label: AS_STATUS_LABEL.pending },
  { value: "on_hold", label: AS_STATUS_LABEL.on_hold },
  { value: "completed", label: AS_STATUS_LABEL.completed },
  { value: "repeat", label: AS_STATUS_LABEL.repeat },
];

const SORT_OPTIONS: DdOption[] = [
  { value: "desc", label: "최신순" },
  { value: "asc", label: "오래된순" },
];

export function AsReceptionList({ refreshSignal }: AsReceptionListProps = {}) {
  const [buildingId, setBuildingId] = useState<number>();
  const [statuses, setStatuses] = useState<ComplaintStatus[]>([]);
  const [managerId, setManagerId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [categoryId, setCategoryId] = useState<number>();
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [search] = useState("");

  const complaintsQuery = useComplaints({
    buildingId,
    categoryId,
    statuses,
    search,
  });
  const isComplaintListRefreshing = complaintsQuery.isFetching && !complaintsQuery.isLoading;
  const { refetch } = complaintsQuery;
  const { data: buildings = [] } = useBuildings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useAsCategories();

  useEffect(() => {
    if (refreshSignal === undefined) return;
    void refetch();
  }, [refetch, refreshSignal]);

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.userId, account.fullName])),
    [accounts],
  );
  const nameOf = useCallback(
    (id?: string | null) => (id ? accountNames.get(id) ?? "-" : "-"),
    [accountNames],
  );

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
  const managerOptions = useMemo<DdOption[]>(
    () => [
      { value: "", label: "담당자 전체" },
      ...accounts
        .filter((account) => account.staffType === "field_staff")
        .map((account) => ({ value: account.userId, label: account.fullName })),
    ],
    [accounts],
  );
  const receiverOptions = useMemo<DdOption[]>(
    () => [
      { value: "", label: "접수자 전체" },
      ...accounts.map((account) => ({
        value: account.userId,
        label: account.fullName,
      })),
    ],
    [accounts],
  );
  const categoryOptions = useMemo<DdOption[]>(
    () => [
      { value: "", label: "유형 전체" },
      ...categories.map((category) => ({
        value: String(category.id),
        label: category.label,
      })),
    ],
    [categories],
  );

  const complaints = useMemo(
    () =>
      [...(complaintsQuery.data ?? [])]
        .filter(
          (complaint) =>
            (!managerId || complaint.assignedTo === managerId) &&
            (!receiverId || complaint.createdBy === receiverId),
        )
        .sort((left, right) => {
          const compared = left.receivedAt.localeCompare(right.receivedAt);
          return sort === "asc" ? compared : -compared;
        }),
    [complaintsQuery.data, managerId, receiverId, sort],
  );

  return (
    <>
      <div className="flex gap-1.5 py-[10px] px-[14px] border-b border-line flex-wrap bg-white items-center">
        <FilterDropdown
          label="건물 선택"
          value={buildingId === undefined ? "" : String(buildingId)}
          options={buildingOptions}
          onChange={(value) => setBuildingId(value ? Number(value) : undefined)}
          searchable
          ariaLabel="건물 선택"
        />
        <MultiFilterDropdown
          label="결과 선택"
          values={statuses}
          options={STATUS_OPTIONS}
          onChange={(values) => setStatuses(values as ComplaintStatus[])}
          ariaLabel="A/S 처리 결과"
        />
        <FilterDropdown
          label="담당자 전체"
          value={managerId}
          options={managerOptions}
          onChange={setManagerId}
          ariaLabel="담당자 선택"
        />
        <FilterDropdown
          label="접수자 전체"
          value={receiverId}
          options={receiverOptions}
          onChange={setReceiverId}
          ariaLabel="접수자 선택"
        />
        <FilterDropdown
          label="유형 전체"
          value={categoryId === undefined ? "" : String(categoryId)}
          options={categoryOptions}
          onChange={(value) => setCategoryId(value ? Number(value) : undefined)}
          ariaLabel="A/S 유형 선택"
        />
        <FilterDropdown
          label="최신순"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) => setSort(value as "desc" | "asc")}
          ariaLabel="A/S 정렬"
        />
      </div>
      <div className="relative flex-1 overflow-auto p-3 flex flex-col gap-2 bg-white">
        {isComplaintListRefreshing ? (
          <div className="sticky right-2 top-2 z-10 ml-auto w-fit rounded-lg bg-white/95 shadow-card">
            <Spinner label="A/S 접수 목록 갱신 중" size="small" showLabel className="px-3 py-2" />
          </div>
        ) : null}
        {complaintsQuery.isLoading ? (
          <Spinner label="A/S 접수 목록 불러오는 중" />
        ) : complaintsQuery.error ? (
          <div role="alert"><EmptyState message="접수 내역을 불러오지 못했어요" /></div>
        ) : complaints.length === 0 ? (
          <EmptyState message="접수 내역이 없어요" />
        ) : (
          complaints.map((complaint) => (
            <AsReceptionCard
              key={complaint.id}
              complaint={complaint}
              nameOf={nameOf}
            />
          ))
        )}
      </div>
    </>
  );
}
