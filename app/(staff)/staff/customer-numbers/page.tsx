"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Input, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useCustomerNumberLookup,
  type CustomerNumberFilters,
  type CustomerNumberKind,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { hasModule } from "@/lib/auth/permissions";
import { CustomerNumberLookupTable } from "./components/CustomerNumberLookupTable";

const KIND_OPTIONS: { value: "" | CustomerNumberKind; label: string }[] = [
  { value: "", label: "전체" },
  { value: "water", label: "수도" },
  { value: "common_elec", label: "공용전기" },
  { value: "elec", label: "전기" },
  { value: "gas", label: "가스" },
];

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

function CustomerNumberLookup() {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [kind, setKind] = useState<CustomerNumberKind | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const buildingsQuery = useBuildings();
  const filters = useMemo<CustomerNumberFilters>(
    () => ({ buildingId, kind, q: debouncedQ }),
    [buildingId, debouncedQ, kind],
  );
  const lookupQuery = useCustomerNumberLookup(filters);
  const buildings = buildingsQuery.data ?? [];
  const rows = lookupQuery.data ?? [];
  const isLoading = buildingsQuery.isLoading || lookupQuery.isLoading;
  const isError = buildingsQuery.isError || lookupQuery.isError;

  const retry = () => {
    void buildingsQuery.refetch();
    void lookupQuery.refetch();
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-t3">관리업무 · 고객번호 조회</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">고객번호 조회</h1>
          <p className="mt-2 text-sm text-t2">
            건물별 수도·전기·가스 고객번호와 고지서 설정을 조회합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled
          title="엑셀 다운로드는 다음 작업에서 지원됩니다."
        >
          엑셀 다운로드
        </Button>
      </header>

      <section
        aria-label="고객번호 조회 조건"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_180px_minmax(240px,1.5fr)]">
          <label className="space-y-1.5 text-xs font-bold text-t2">
            건물
            <Select
              aria-label="건물 필터"
              value={buildingId?.toString() ?? ""}
              disabled={buildingsQuery.isLoading}
              onChange={(event) =>
                setBuildingId(event.target.value ? Number(event.target.value) : null)
              }
              options={[
                { value: "", label: "전체" },
                ...buildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            유형
            <Select
              aria-label="유형 필터"
              value={kind ?? ""}
              onChange={(event) =>
                setKind((event.target.value || null) as CustomerNumberKind | null)
              }
              options={KIND_OPTIONS}
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            검색
            <Input
              aria-label="고객번호 또는 명의자 검색"
              type="search"
              value={q}
              placeholder="고객번호 또는 명의자 검색"
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface shadow-card">
        {isError ? (
          <div role="alert" className="p-8 text-center">
            <p className="text-sm font-semibold text-red">
              고객번호 목록을 불러오지 못했습니다. 다시 시도해 주세요.
            </p>
            <Button type="button" variant="ghost" className="mt-4" onClick={retry}>
              다시 시도
            </Button>
          </div>
        ) : isLoading ? (
          <div role="status" aria-label="고객번호 조회 중" className="py-12">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="조건에 맞는 고객번호가 없습니다" />
        ) : (
          <CustomerNumberLookupTable
            rows={rows}
            onRowClick={(row) => router.push(`/staff/buildings/${row.buildingId}`)}
          />
        )}
      </section>
    </div>
  );
}

export default function CustomerNumberLookupPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "buildings")) {
    return (
      <div className="p-6">
        <EmptyState message="고객번호 조회 권한이 없습니다" />
      </div>
    );
  }

  return <CustomerNumberLookup />;
}
