"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, Pagination, Spinner } from "@/components/common";
import {
  useCustomerNumberLookup,
  type CustomerNumberFilters,
  type CustomerNumberLookupKind,
} from "@/hooks/reactquery/buildingCustomerNumbers";
import { CustomerNumberLookupTable } from "./CustomerNumberLookupTable";
import { CustomerNumberLookupToolbar } from "./CustomerNumberLookupToolbar";

const PAGE_SIZE = 50;

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

function customerNumberExportUrl(filters: CustomerNumberFilters) {
  const params = new URLSearchParams({ kind: filters.kind });
  const query = filters.q?.trim();
  if (query) params.set("q", query);
  return `/api/customer-numbers/export?${params.toString()}`;
}

export function CustomerNumberLookupContent() {
  const [kind, setKind] = useState<CustomerNumberLookupKind>("water");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query, 300);
  const filters = useMemo<CustomerNumberFilters>(
    () => ({ kind, q: debouncedQuery, page, pageSize: PAGE_SIZE }),
    [debouncedQuery, kind, page],
  );
  const lookupQuery = useCustomerNumberLookup(filters);
  const rows = lookupQuery.data?.rows ?? [];
  const total = lookupQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeKind = (nextKind: CustomerNumberLookupKind) => {
    setKind(nextKind);
    setPage(1);
  };

  const exportCustomerNumbers = () => {
    const anchor = document.createElement("a");
    anchor.href = customerNumberExportUrl(filters);
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return (
    <div className="min-h-[calc(100vh-62px)] bg-bg p-[18px] sm:p-[22px]">
      <CustomerNumberLookupToolbar
        kind={kind}
        total={total}
        query={query}
        onKindChange={changeKind}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onExport={exportCustomerNumbers}
      />

      <section className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {lookupQuery.isError ? (
          <div role="alert" className="p-8 text-center">
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
          <div role="status" aria-label="고객번호 조회 중" className="py-12">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="검색 결과가 없습니다" />
        ) : (
          <CustomerNumberLookupTable rows={rows} kind={kind} />
        )}

        {!lookupQuery.isError && !lookupQuery.isLoading && rows.length > 0 && (
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
