"use client";

import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { QuickAccessRail } from "@/components/shell/QuickAccessRail";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import {
  useSaveSettlementInquiryEdits,
  useSettlementInquiry,
  type SettlementInquiryEdit,
  type SettlementInquiryRow,
  type SettlementInquirySort,
  type SettlementInquiryStatus,
  type SettlementInquiryType,
} from "@/hooks/reactquery/movingSettlement";
import { hasModule } from "@/lib/auth/permissions";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { SettlementInquiryPrintHeader } from "./settlement-inquiry/SettlementInquiryPrintHeader";
import { SettlementInquiryTable } from "./settlement-inquiry/SettlementInquiryTable";
import { SettlementInquiryToolbar } from "./settlement-inquiry/SettlementInquiryToolbar";

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

export function SettlementInquiryPage({ type }: { type: SettlementInquiryType }) {
  const range = currentMonthRange();
  const { data: me } = useMe();
  const { data: organizationName } = useBillOrganizationName(me?.orgId);
  const [fromMonth, setFromMonth] = useState(range.fromMonth);
  const [toMonth, setToMonth] = useState(range.toMonth);
  const [status, setStatus] = useState<"" | SettlementInquiryStatus>("");
  const [sort, setSort] = useState<SettlementInquirySort>("code");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [edits, setEdits] = useState<Record<number, SettlementInquiryEdit>>({});
  const saveEdits = useSaveSettlementInquiryEdits();
  const from = `${fromMonth}-01`;
  const to = monthEnd(toMonth);
  const inquiryQuery = useSettlementInquiry({
    type,
    from,
    to,
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
  const invalidRange = fromMonth > toMonth;
  const editRow = (row: SettlementInquiryRow, patch: Partial<SettlementInquiryEdit>) => {
    setEdits((current) => {
      const previous = current[row.settlementId];
      const next: SettlementInquiryEdit = {
        settlementId: row.settlementId,
        elecPaidDate: previous ? previous.elecPaidDate : row.elecPaidDate,
        gasPaidDate: previous ? previous.gasPaidDate : row.gasPaidDate,
        cleaningCost: previous ? previous.cleaningCost : row.cleaningCost,
        ...patch,
      };
      const result = { ...current };
      if (
        next.elecPaidDate === row.elecPaidDate
        && next.gasPaidDate === row.gasPaidDate
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
    window.print();
  };

  return (
    <div className="h-[calc(100dvh-62px)] min-h-[560px] bg-bg px-[24px] pb-[22px] pt-[22px] print:h-auto print:min-h-0 print:bg-white print:p-0">
      <section aria-label={`${TYPE_LABELS[type]} 이사조회`} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] bg-white shadow-card print:relative print:overflow-visible print:rounded-none print:shadow-none">
        <SettlementInquiryPrintHeader
          type={type}
          companyName={organizationName ?? PROGRAM_COMPANY_NAME}
          fromMonth={fromMonth}
          toMonth={toMonth}
        />
        <div className="overflow-x-auto print:hidden">
          <SettlementInquiryToolbar
            fromMonth={fromMonth}
            toMonth={toMonth}
            status={status}
            sort={sort}
            search={search}
            changedCount={Object.keys(edits).length}
            saving={saveEdits.isPending}
            onFromMonthChange={setFromMonth}
            onToMonthChange={setToMonth}
            onStatusChange={setStatus}
            onSortChange={setSort}
            onSearchChange={setSearch}
            onPrint={print}
            onSave={save}
          />
        </div>
        <div className="min-h-0 flex-1 print:relative print:z-10">
        {invalidRange ? (
          <div className="py-16"><EmptyState message="조회 시작월은 종료월보다 늦을 수 없습니다." /></div>
        ) : inquiryQuery.isLoading ? (
          <div className="py-16"><Spinner /></div>
        ) : inquiryQuery.error ? (
          <div className="py-16"><EmptyState message="이사정산 조회 결과를 불러오지 못했습니다." /></div>
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
      <QuickAccessRail />
    </div>
  );
}
