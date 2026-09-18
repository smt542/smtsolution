"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useSettlementInquiry,
  useUpdateSettlementInquiryRows,
  type SettlementInquiryRow,
  type SettlementInquirySort,
  type SettlementInquiryStatus,
} from "@/hooks/reactquery/movingSettlement";
import { hasModule } from "@/lib/auth/permissions";
import { AllSettlementInquiryTable } from "./AllSettlementInquiryTable";
import { AllSettlementInquiryToolbar } from "./AllSettlementInquiryToolbar";
import {
  monthEnd,
  numericInput,
  parseNumericInput,
  type EditableInquiryField,
  type SettlementInquiryEdits,
} from "./settlementInquiryTypes";

type UnifiedStatus = "" | Extract<
  SettlementInquiryStatus,
  "completed" | "incomplete"
>;

interface PeriodState {
  fromYear: string;
  fromMonth: string;
  toYear: string;
  toMonth: string;
}

function initialPeriod(): PeriodState {
  const today = new Date();
  return {
    fromYear: String(today.getFullYear()),
    fromMonth: "01",
    toYear: String(today.getFullYear()),
    toMonth: String(today.getMonth() + 1).padStart(2, "0"),
  };
}

function baselineValue(
  row: SettlementInquiryRow,
  field: EditableInquiryField,
): string {
  if (field === "elecPaidDate") return row.elecPaidDate ?? "";
  if (field === "gasPaidDate") return row.gasPaidDate ?? "";
  return row.cleaningCost === null ? "" : String(row.cleaningCost);
}

export function AllSettlementInquiryPage() {
  const { data: me } = useMe();
  const [period, setPeriod] = useState<PeriodState>(initialPeriod);
  const [status, setStatus] = useState<UnifiedStatus>("");
  const [sort, setSort] = useState<SettlementInquirySort>("code");
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<SettlementInquiryEdits>({});
  const deferredSearch = useDeferredValue(search);
  const from = `${period.fromYear}-${period.fromMonth}-01`;
  const to = monthEnd(period.toYear, period.toMonth);
  const invalidRange = from > to;
  const inquiryQuery = useSettlementInquiry({
    type: "all",
    from,
    to,
    search: deferredSearch.trim() || undefined,
    status: status || undefined,
    sort,
    page: 1,
    pageSize: 500,
  });
  const updateRows = useUpdateSettlementInquiryRows();
  const rows = useMemo(
    () => inquiryQuery.data?.rows ?? [],
    [inquiryQuery.data?.rows],
  );
  const isAllSettlementInquiryRefreshing = inquiryQuery.isFetching && !inquiryQuery.isLoading;
  const currentYear = Number(period.toYear);
  const years = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => currentYear + 1 - index).map(
        (year) => ({ value: String(year), label: `${year}년` }),
      ),
    [currentYear],
  );
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const value = String(index + 1).padStart(2, "0");
        return { value, label: `${value}월` };
      }),
    [],
  );

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  const editRow = (
    row: SettlementInquiryRow,
    field: EditableInquiryField,
    nextValue: string,
  ) => {
    const value = field === "cleaningCost" ? numericInput(nextValue) : nextValue;
    const baseline = baselineValue(row, field);

    setEdits((current) => {
      const next = { ...current };
      const rowEdit = { ...next[row.settlementId] };
      if (value === baseline) delete rowEdit[field];
      else rowEdit[field] = value;

      if (Object.keys(rowEdit).length === 0) delete next[row.settlementId];
      else next[row.settlementId] = rowEdit;
      return next;
    });
  };

  const save = () => {
    const payload = Object.entries(edits).flatMap(([id, edit]) => {
      const row = rows.find((item) => item.settlementId === Number(id));
      if (!row) return [];
      return [{
        settlementId: row.settlementId,
        elecPaidDate: edit.elecPaidDate ?? row.elecPaidDate,
        gasPaidDate: edit.gasPaidDate ?? row.gasPaidDate,
        waterPaidDate: row.waterPaidDate,
        cleaningCost:
          edit.cleaningCost === undefined
            ? row.cleaningCost
            : parseNumericInput(edit.cleaningCost),
      }];
    });

    if (payload.length === 0) return;
    updateRows.mutate(payload, {
      onSuccess: (result) => {
        setEdits({});
        toast.success(`전체 이사조회 ${result.count}건을 저장했습니다.`);
      },
      onError: () => toast.error("전체 이사조회 저장에 실패했습니다."),
    });
  };

  const print = () => {
    if (rows.length === 0) {
      toast.error("출력할 내역이 없어요.");
      return;
    }
    window.print();
  };

  return (
    <div
      className="moving-inquiry-page relative flex h-[calc(100vh-62px)] min-h-[620px] flex-col overflow-hidden p-[22px_24px_24px] print:h-auto print:min-h-0 print:overflow-visible print:p-0"
      data-node-id="673:185380"
    >
      <div className="moving-inquiry-print-title hidden print:mb-4 print:block">
        <p className="text-sm font-bold text-t3">관리비서 · 이사정산</p>
        <h1 className="mt-1 text-2xl font-extrabold text-t1">전체 이사조회</h1>
        <p className="mt-1 text-sm text-t2">
          {period.fromYear}.{period.fromMonth} ~ {period.toYear}.{period.toMonth}
        </p>
      </div>
      <div className="moving-inquiry-watermark pointer-events-none absolute inset-0 hidden items-center justify-center text-[92px] font-black text-t1/[0.035] print:flex">
        관리비서
      </div>
      <section
        className="moving-inquiry-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card print:overflow-visible print:rounded-none print:shadow-none"
        data-node-id="673:185381"
      >
        {isAllSettlementInquiryRefreshing ? (
          <div className="absolute right-5 top-3 z-10 rounded-lg bg-white/95 shadow-card print:hidden">
            <Spinner label="전체 이사조회 결과 갱신 중" size="small" showLabel className="px-3 py-2" />
          </div>
        ) : null}
        <div className="overflow-x-auto overflow-y-hidden">
          <AllSettlementInquiryToolbar
            years={years}
            months={months}
            fromYear={period.fromYear}
            fromMonth={period.fromMonth}
            toYear={period.toYear}
            toMonth={period.toMonth}
            status={status}
            sort={sort}
            search={search}
            dirty={Object.keys(edits).length > 0}
            saving={updateRows.isPending}
            hasRows={rows.length > 0}
            onFromYearChange={(fromYear) =>
              setPeriod((current) => ({ ...current, fromYear }))
            }
            onFromMonthChange={(fromMonth) =>
              setPeriod((current) => ({ ...current, fromMonth }))
            }
            onToYearChange={(toYear) =>
              setPeriod((current) => ({ ...current, toYear }))
            }
            onToMonthChange={(toMonth) =>
              setPeriod((current) => ({ ...current, toMonth }))
            }
            onStatusChange={setStatus}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onPrint={print}
            onSave={save}
          />
        </div>

        {invalidRange ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState message="조회 시작월은 종료월보다 늦을 수 없습니다." />
          </div>
        ) : inquiryQuery.isLoading ? (
          <div className="flex min-h-[360px] flex-1 items-center justify-center">
            <Spinner label="전체 이사조회 결과 불러오는 중" />
          </div>
        ) : inquiryQuery.error ? (
          <div role="alert" className="flex min-h-[360px] flex-1 items-center justify-center p-8">
            <EmptyState message="전체 이사조회 결과를 불러오지 못했습니다." />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState message="조건에 맞는 이사정산 내역이 없습니다." />
          </div>
        ) : (
          <AllSettlementInquiryTable
            rows={rows}
            total={inquiryQuery.data?.total ?? rows.length}
            edits={edits}
            onEdit={editRow}
          />
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {Object.keys(edits).length > 0
          ? `${Object.keys(edits).length}개 행의 변경사항이 저장되지 않았습니다.`
          : "모든 변경사항이 저장되었습니다."}
      </p>
    </div>
  );
}
