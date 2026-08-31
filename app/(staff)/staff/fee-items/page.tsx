"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Input, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildingTypes } from "@/hooks/reactquery/buildingTypes";
import {
  useFeeItemLookup,
  type FeeItemLookupFilters,
} from "@/hooks/reactquery/feeItems";
import { hasModule } from "@/lib/auth/permissions";
import { FeeItemLookupTable } from "./components/FeeItemLookupTable";

const REQUIRED_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "필수" },
  { value: "false", label: "선택" },
];
const PAGE_SIZE = 50;

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

function feeItemExportUrl(filters: FeeItemLookupFilters) {
  const params = new URLSearchParams();
  if (filters.typeId != null) params.set("typeId", String(filters.typeId));
  if (filters.required != null) params.set("required", String(filters.required));
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  const query = params.toString();
  return `/api/fee-items/export${query ? `?${query}` : ""}`;
}

function FeeItemLookup() {
  const [typeId, setTypeId] = useState<number | null>(null);
  const [required, setRequired] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 300);

  const buildingTypesQuery = useBuildingTypes();
  const filters = useMemo<FeeItemLookupFilters>(
    () => ({ typeId, required, q: debouncedQ, page, pageSize: PAGE_SIZE }),
    [debouncedQ, page, required, typeId],
  );
  const lookupQuery = useFeeItemLookup(filters);
  const buildingTypes = buildingTypesQuery.data ?? [];
  const rows = lookupQuery.data?.rows ?? [];
  const total = lookupQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isLoading = buildingTypesQuery.isLoading || lookupQuery.isLoading;
  const isError = buildingTypesQuery.isError || lookupQuery.isError;

  const retry = () => {
    void buildingTypesQuery.refetch();
    void lookupQuery.refetch();
  };

  const exportFeeItems = () => {
    const anchor = document.createElement("a");
    anchor.href = feeItemExportUrl(filters);
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-t3">관리업무 · 항목등록 관리</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">항목등록 관리</h1>
          <p className="mt-2 text-sm text-t2">
            건물유형별 관리비 항목과 부과 설정을 조회합니다.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={exportFeeItems}>
          엑셀 다운로드
        </Button>
      </header>

      <section
        aria-label="관리비 항목 조회 조건"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_180px_minmax(240px,1.5fr)]">
          <label className="space-y-1.5 text-xs font-bold text-t2">
            건물유형
            <Select
              aria-label="건물유형 필터"
              value={typeId?.toString() ?? ""}
              disabled={buildingTypesQuery.isLoading}
              onChange={(event) => {
                setTypeId(event.target.value ? Number(event.target.value) : null);
                setPage(1);
              }}
              options={[
                { value: "", label: "전체" },
                ...buildingTypes.map((buildingType) => ({
                  value: String(buildingType.id),
                  label: buildingType.label,
                })),
              ]}
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            필수여부
            <Select
              aria-label="필수여부 필터"
              value={required === null ? "" : String(required)}
              onChange={(event) => {
                const value = event.target.value;
                setRequired(value === "" ? null : value === "true");
                setPage(1);
              }}
              options={REQUIRED_OPTIONS}
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            검색
            <Input
              aria-label="항목명 검색"
              type="search"
              value={q}
              placeholder="항목명 검색"
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface shadow-card">
        {isError ? (
          <div role="alert" className="p-8 text-center">
            <p className="text-sm font-semibold text-red">
              관리비 항목 목록을 불러오지 못했습니다. 다시 시도해 주세요.
            </p>
            <Button type="button" variant="ghost" className="mt-4" onClick={retry}>
              다시 시도
            </Button>
          </div>
        ) : isLoading ? (
          <div role="status" aria-label="관리비 항목 조회 중" className="py-12">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="조건에 맞는 관리비 항목이 없습니다" />
        ) : (
          <FeeItemLookupTable rows={rows} />
        )}
        {!isError && !isLoading && rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <span className="text-xs font-semibold text-t3">총 {total.toLocaleString("ko-KR")}건</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                이전
              </Button>
              <span className="num text-xs text-t3">{page} / {totalPages}</span>
              <Button
                type="button"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function FeeItemLookupPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "billing")) {
    return (
      <div className="p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  return <FeeItemLookup />;
}
