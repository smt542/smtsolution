"use client";

import { useMemo, useState } from "react";
import { Button, Pagination, Spinner } from "@/components/common";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/common";
import {
  useCustomerNumberLookup,
  type CustomerNumberFilters,
  type CustomerNumberLookupKind,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import { CustomerNumberLookupHeader } from "./CustomerNumberLookupHeader";
import { CustomerNumberLookupTable } from "./CustomerNumberLookupTable";

const PAGE_SIZE = 50;

function CustomerNumberLookupEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[6px] px-6 pb-14 pt-12 text-center">
      <div className="mb-[5px] flex size-[58px] items-center justify-center rounded-[17px] bg-teal-t text-teal">
        <svg
          aria-hidden="true"
          className="size-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
      </div>
      <p className="text-[16px] font-bold tracking-[-0.02em] text-t1">
        검색 결과가 없어요
      </p>
      <p className="text-[13.5px] font-normal leading-[1.6] text-t3">
        고객번호나 건물명으로 다시 검색해 주세요
      </p>
    </div>
  );
}

export function CustomerNumberLookupContent() {
  const [kind, setKind] = useState<CustomerNumberLookupKind>("water");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const q = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const filters = useMemo<CustomerNumberFilters>(
    () => ({ kind, q: q || undefined, page, pageSize: PAGE_SIZE }),
    [kind, q, page],
  );
  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ kind });
    if (q) params.set("q", q);
    return `/api/customer-numbers/export?${params.toString()}`;
  }, [kind, q]);
  const lookupQuery = useCustomerNumberLookup(filters);
  const rows = lookupQuery.data?.rows ?? [];
  const total = lookupQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeKind = (nextKind: CustomerNumberLookupKind) => {
    setKind(nextKind);
    setPage(1);
  };

  const changeSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  return (
    <div className="flex h-[calc(100dvh-62px)] min-h-[420px] flex-col overflow-hidden bg-bg px-6 pb-6 pt-[22px]">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
        <CustomerNumberLookupHeader
          kind={kind}
          total={total}
          search={searchInput}
          exportHref={exportHref}
          onKindChange={changeKind}
          onSearchChange={changeSearch}
        />

        {lookupQuery.isError ? (
          <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-semibold text-red">
              고객번호 목록을 불러오지 못했습니다. 다시 시도해 주세요.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              onClick={() => void lookupQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : lookupQuery.isLoading ? (
          <div
            role="status"
            aria-label="고객번호 조회 중"
            className="flex min-h-0 flex-1 items-center justify-center"
          >
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <CustomerNumberLookupEmptyState />
        ) : (
          <CustomerNumberLookupTable rows={rows} kind={kind} />
        )}

        {!lookupQuery.isError &&
          !lookupQuery.isLoading &&
          rows.length > 0 &&
          totalPages > 1 && (
          <div className="border-t border-line px-4 py-3">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>
    </div>
  );
}
