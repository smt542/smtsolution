"use client";

import { useDeferredValue, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  useUpdateSettlementInquiryRows,
  useSettlementInquiry,
  type UpdateSettlementInquiryRow,
  type SettlementInquiryRow,
  type SettlementInquirySort,
  type SettlementInquiryStatus,
  type SettlementInquiryType,
} from "@/hooks/reactquery/movingSettlement";
import { hasModule } from "@/lib/auth/permissions";
import { SettlementInquiryTable } from "./settlement-inquiry/SettlementInquiryTable";
import type { UtilityInquiryType } from "./settlement-inquiry/utilityInquiryColumns";
import { SettlementInquiryToolbar } from "./settlement-inquiry/SettlementInquiryToolbar";
import { printUtilityInquiry } from "./settlement-inquiry/utilityInquiryPrint";

const TYPE_LABELS: Record<SettlementInquiryType, string> = {
  water: "수도",
  electric: "전기",
  gas: "가스",
  all: "전체",
};

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    fromMonth: `${year}-01`,
    toMonth: `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  };
}

function monthEnd(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return `${month}-${String(new Date(year, value, 0).getDate()).padStart(2, "0")}`;
}

// `all` 은 라우트에서 AllSettlementInquiryPage 로 빠지므로 이 화면은 공과금 3종만 받는다.
export function SettlementInquiryPage({ type }: { type: UtilityInquiryType }) {
  const range = currentMonthRange();
  const { data: me } = useMe();
  const { data: setupConfig } = useSetupConfig(me?.orgId);
  const [fromMonth, setFromMonth] = useState(range.fromMonth);
  const [toMonth, setToMonth] = useState(range.toMonth);
  const [appliedFrom, setAppliedFrom] = useState(`${range.fromMonth}-01`);
  const [appliedFromManuallySet, setAppliedFromManuallySet] = useState(false);
  const [status, setStatus] = useState<"" | SettlementInquiryStatus>("");
  const [sort, setSort] = useState<SettlementInquirySort>("code");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [edits, setEdits] = useState<Record<number, UpdateSettlementInquiryRow>>({});
  const saveEdits = useUpdateSettlementInquiryRows();
  const from = `${fromMonth}-01`;
  const to = monthEnd(toMonth);
  const inquiryQuery = useSettlementInquiry({
    type,
    from,
    to,
    appliedFrom,
    search: deferredSearch || undefined,
    status: status || undefined,
    sort,
    page: 1,
    pageSize: 100,
  });

  if (me === undefined) return null;
  if (!hasModule(me, "moving")) {
    return (
      <div className="p-6">
        <EmptyState message="이 화면에 접근할 권한이 없습니다. (이사정산 권한 필요)" />
      </div>
    );
  }

  const rows = inquiryQuery.data?.rows ?? [];
  const isSettlementInquiryRefreshing = inquiryQuery.isFetching && !inquiryQuery.isLoading;
  const invalidRange = fromMonth > toMonth;
  const editRow = (row: SettlementInquiryRow, patch: Partial<UpdateSettlementInquiryRow>) => {
    setEdits((current) => {
      const previous = current[row.settlementId];
      const next: UpdateSettlementInquiryRow = {
        settlementId: row.settlementId,
        elecPaidDate: previous ? previous.elecPaidDate : row.elecPaidDate,
        gasPaidDate: previous ? previous.gasPaidDate : row.gasPaidDate,
        waterPaidDate: previous ? previous.waterPaidDate : row.waterPaidDate,
        cleaningCost: previous ? previous.cleaningCost : row.cleaningCost,
        ...patch,
      };
      const result = { ...current };
      if (
        next.elecPaidDate === row.elecPaidDate
        && next.gasPaidDate === row.gasPaidDate
        && next.waterPaidDate === row.waterPaidDate
        && next.cleaningCost === row.cleaningCost
      ) {
        delete result[row.settlementId];
      } else {
        result[row.settlementId] = next;
      }
      return result;
    });
  };

  const save = () => {
    const changed = Object.values(edits);
    if (changed.length === 0) return;
    saveEdits.mutate(changed, {
      onSuccess: ({ count }) => {
        setEdits({});
        toast.success(`변경사항 ${count}건을 저장했어요.`);
      },
      onError: () => toast.error("변경사항을 저장하지 못했어요. 다시 시도해 주세요."),
    });
  };

  const print = () => {
    if (rows.length === 0) {
      toast.info("출력할 내역이 없어요.");
      return;
    }
    printUtilityInquiry(
      type,
      rows,
      edits,
      appliedFrom,
      setupConfig
        ? {
            companyName: setupConfig.companyName,
            companyPhone: setupConfig.companyPhone,
            companyFax: setupConfig.companyFax,
            ceoName: setupConfig.ceoName,
            companyAddress: setupConfig.companyAddress,
            settleBank: setupConfig.settleBank,
            settleAcct: setupConfig.settleAcct,
            settleHolder: setupConfig.settleHolder,
          }
        : undefined,
    );
  };

  return (
    <div className="h-[calc(100dvh-62px)] min-h-[560px] bg-bg px-[24px] pb-[22px] pt-[22px]">
      <section aria-label={`${TYPE_LABELS[type]} 이사조회`} className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        {isSettlementInquiryRefreshing ? (
          <div className="absolute right-5 top-3 z-10 rounded-lg bg-white/95 shadow-card">
            <Spinner label="이사정산 조회 결과 갱신 중" size="small" showLabel className="px-3 py-2" />
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <SettlementInquiryToolbar
            fromMonth={fromMonth}
            toMonth={toMonth}
            appliedFrom={appliedFrom}
            status={status}
            sort={sort}
            search={search}
            changedCount={Object.keys(edits).length}
            saving={saveEdits.isPending}
            onFromMonthChange={(value) => {
              setFromMonth(value);
              if (!appliedFromManuallySet) setAppliedFrom(`${value}-01`);
            }}
            onToMonthChange={setToMonth}
            onAppliedFromChange={(value) => {
              setAppliedFrom(value);
              setAppliedFromManuallySet(true);
            }}
            onStatusChange={setStatus}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onPrint={print}
            onSave={save}
          />
        </div>
        <div className="min-h-0 flex-1">
        {invalidRange ? (
          <div className="py-16"><EmptyState message="조회 시작월은 종료월보다 늦을 수 없습니다." /></div>
        ) : inquiryQuery.isLoading ? (
          <div className="flex min-h-[360px] flex-1 items-center justify-center"><Spinner label="이사정산 조회 결과 불러오는 중" /></div>
        ) : inquiryQuery.error ? (
          <div role="alert" className="flex min-h-[360px] flex-1 items-center justify-center"><EmptyState message="이사정산 조회 결과를 불러오지 못했습니다." /></div>
        ) : rows.length === 0 ? (
          <div className="py-16"><EmptyState message="조회 결과가 없어요 · 조회 기간이나 검색어를 바꿔 보세요" /></div>
        ) : (
          <SettlementInquiryTable
            type={type}
            rows={rows}
            total={inquiryQuery.data?.total}
            edits={edits}
            onEdit={editRow}
          />
        )}
        </div>
      </section>
    </div>
  );
}
