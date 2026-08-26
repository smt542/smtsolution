"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Select, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  type PaymentRow,
} from "@/hooks/reactquery/payments";
import {
  type ReceiptStatementDocument,
  type ReceiptStatementUtilityRow,
  useReceiptStatementData,
} from "@/hooks/reactquery/receipts";
import {
  type UtilityType,
} from "@/hooks/reactquery/utilities";
import { fromMonthInput, toMonthInput } from "@/lib/billing/period";
import {
  PaymentStatementPrintView,
  type PaymentStatementRow,
  type PaymentStatementUtility,
} from "./PaymentStatementPrintView";

interface PaymentStatementModalProps {
  building: Building;
  companyName: string;
  currentPeriod: string;
  currentRows: PaymentRow[];
  initialUnitId: number | null;
  onClose: () => void;
}

const UTILITY_OPTIONS: Array<{ type: UtilityType; label: string }> = [
  { type: "electricity", label: "전기 표시" },
  { type: "water", label: "수도 표시" },
  { type: "gas", label: "가스 표시" },
];

const EMPTY_UTILITY: PaymentStatementUtility = {
  amount: null,
  previousReading: null,
  currentReading: null,
  usage: null,
  unitPrice: null,
};

function monthIndex(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}

export function paymentPeriods(startMonth: string, endMonth: string) {
  const start = monthIndex(startMonth);
  const end = monthIndex(endMonth);
  if (start === null || end === null || start > end) return [];
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset;
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  });
}

function utilityItemAmount(
  document: ReceiptStatementDocument | undefined,
  utilityType: UtilityType,
) {
  const pattern = utilityType === "electricity"
    ? /전기/
    : utilityType === "water"
      ? /수도/
      : /가스/;
  const matches = (document?.items ?? []).filter(
    (item) => item.charged && pattern.test(item.name),
  );
  return matches.length > 0 ? matches.reduce((sum, item) => sum + item.amount, 0) : null;
}

function lateFee(document: ReceiptStatementDocument | undefined) {
  return (document?.items ?? [])
    .filter((item) => item.charged && /연체|가산/.test(item.name))
    .reduce((sum, item) => sum + item.amount, 0);
}

function toUtility(
  utilityRow: ReceiptStatementUtilityRow | undefined,
  fallbackAmount: number | null,
): PaymentStatementUtility {
  if (!utilityRow) return { ...EMPTY_UTILITY, amount: fallbackAmount };
  return {
    amount: utilityRow.manualCharge ?? utilityRow.automaticCharge ?? fallbackAmount,
    previousReading: utilityRow.previousReading,
    currentReading: utilityRow.currentReading,
    usage: utilityRow.usage,
    unitPrice: utilityRow.resolvedUnitPrice ?? utilityRow.unitPrice,
  };
}

export function PaymentStatementModal({
  building,
  companyName,
  currentPeriod,
  currentRows,
  initialUnitId,
  onClose,
}: PaymentStatementModalProps) {
  const currentMonth = toMonthInput(currentPeriod);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [scope, setScope] = useState<"building" | "unit">(
    initialUnitId === null ? "building" : "unit",
  );
  const [unitId, setUnitId] = useState<number | null>(
    initialUnitId ?? currentRows[0]?.unitId ?? null,
  );
  const [filter, setFilter] = useState<"all" | "unpaid">("all");
  const [utilitySelection, setUtilitySelection] = useState<Record<UtilityType, boolean>>({
    electricity: true,
    water: true,
    gas: true,
  });

  const periods = useMemo(() => paymentPeriods(startMonth, endMonth), [startMonth, endMonth]);
  const selectedUtilityTypes = UTILITY_OPTIONS
    .filter(({ type }) => utilitySelection[type])
    .map(({ type }) => type);

  const statementUnitId = scope === "unit" ? unitId : null;
  const canLoadStatement = periods.length > 0 && (scope === "building" || unitId !== null);
  const statementQuery = useReceiptStatementData(
    building.id,
    statementUnitId,
    periods[0] ?? "",
    periods.at(-1) ?? "",
    canLoadStatement,
  );
  const statementData = canLoadStatement ? statementQuery.data : undefined;
  const rowsByPeriod = periods.map((period) => ({
    period,
    rows: (statementData?.paymentRows ?? []).filter((row) => row.period === period),
  }));

  const statementRows = (() => {
    const utilitiesByKey = new Map<string, ReceiptStatementUtilityRow[]>();
    for (const type of UTILITY_OPTIONS.map((option) => option.type)) {
      for (const period of periods) {
        utilitiesByKey.set(
          `${period}:${type}`,
          (statementData?.utilities[type] ?? []).filter((row) => row.period === period),
        );
      }
    }

    return rowsByPeriod.flatMap(({ period, rows }) => {
      const documents = (statementData?.documents ?? [])
        .filter((document) => document.period === period);
      return rows.flatMap((row): PaymentStatementRow[] => {
        const hasData = row.charged !== null || row.paid > 0;
        if (!hasData || (filter === "unpaid" && !(row.unpaid !== null && row.unpaid > 0))) {
          return [];
        }
        const document = documents.find((candidate) => candidate.unitId === row.unitId);
        const activePayments = (statementData?.payments ?? [])
          .filter((payment) => payment.period === period && payment.unitId === row.unitId)
          .filter((payment) => payment.status === "active");
        const paymentDates = activePayments.map((payment) => payment.paidAt);
        const utilities = Object.fromEntries(
          UTILITY_OPTIONS.map(({ type }) => {
            const utilityRow = utilitiesByKey
              .get(`${period}:${type}`)
              ?.find((candidate) => candidate.unitId === row.unitId);
            return [type, toUtility(utilityRow, utilityItemAmount(document, type))];
          }),
        ) as Record<UtilityType, PaymentStatementUtility>;

        return [{
          key: `${period}:${row.unitId}`,
          period,
          unitNo: row.unitNo,
          dong: row.dong,
          tenantName: row.tenantName,
          paymentDates: [...new Set(paymentDates)],
          charged: row.charged ?? document?.totalAmount ?? null,
          lateFee: lateFee(document),
          paid: row.paid,
          unpaid: row.unpaid,
          utilities,
        }];
      });
    });
  })();

  const isLoading = canLoadStatement
    && (statementQuery.isLoading || statementQuery.isFetching);
  const isError = canLoadStatement && statementQuery.isError;
  const selectedRow = currentRows.find((row) => row.unitId === unitId);
  const scopeLabel = scope === "building"
    ? "건물 전체"
    : selectedRow
      ? `${selectedRow.dong ? `${selectedRow.dong} ` : ""}${selectedRow.unitNo}`
      : "세대 미선택";

  const preview = (
    <PaymentStatementPrintView
      building={building}
      companyName={companyName}
      startPeriod={fromMonthInput(startMonth)}
      endPeriod={fromMonthInput(endMonth)}
      scopeLabel={scopeLabel}
      utilityTypes={selectedUtilityTypes}
      rows={statementRows}
    />
  );

  const changeStartMonth = (value: string) => {
    setStartMonth(value);
    if (value > endMonth) setEndMonth(value);
  };
  const changeEndMonth = (value: string) => {
    setEndMonth(value);
    if (value < startMonth) setStartMonth(value);
  };

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-statement-modal-title"
      >
        <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-surface shadow-pop">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-bold text-brand">수납 내역 · 기간 출력</p>
              <h2 id="payment-statement-modal-title" className="mt-0.5 text-xl font-extrabold text-t1">
                수납명세서 미리보기
              </h2>
            </div>
            <button
              type="button"
              aria-label="수납명세서 미리보기 닫기"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-t3 hover:bg-bg"
            >
              ×
            </button>
          </header>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="overflow-y-auto border-r border-line bg-bg/70 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-bold text-t2">
                  시작월
                  <input
                    type="month"
                    aria-label="명세서 시작월"
                    value={startMonth}
                    max={endMonth}
                    onChange={(event) => changeStartMonth(event.target.value)}
                    className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1 focus:border-brand focus:outline-none"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-bold text-t2">
                  종료월
                  <input
                    type="month"
                    aria-label="명세서 종료월"
                    value={endMonth}
                    min={startMonth}
                    onChange={(event) => changeEndMonth(event.target.value)}
                    className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1 focus:border-brand focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold text-t2">출력 기준</p>
                <div className="mt-2 grid grid-cols-2 rounded-xl bg-surface p-1 ring-1 ring-line">
                  {(["building", "unit"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      className={`h-9 rounded-lg text-xs font-bold ${scope === value ? "bg-brand text-white" : "text-t2"}`}
                    >
                      {value === "building" ? "건물 전체" : "세대"}
                    </button>
                  ))}
                </div>
              </div>

              {scope === "unit" && (
                <label className="mt-4 block space-y-1.5 text-xs font-bold text-t2">
                  세대 선택
                  <Select
                    aria-label="명세서 세대 선택"
                    value={unitId?.toString() ?? ""}
                    onChange={(event) => setUnitId(event.target.value ? Number(event.target.value) : null)}
                    options={currentRows.length > 0
                      ? currentRows.map((row) => ({
                          value: String(row.unitId),
                          label: `${row.dong ? `${row.dong} ` : ""}${row.unitNo} · ${row.tenantName ?? "세대주 미등록"}`,
                        }))
                      : [{ value: "", label: "선택 가능한 세대 없음" }]}
                  />
                </label>
              )}

              <label className="mt-5 block space-y-1.5 text-xs font-bold text-t2">
                표시 범위
                <Select
                  aria-label="명세서 표시 범위"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as "all" | "unpaid")}
                  options={[
                    { value: "all", label: "전체" },
                    { value: "unpaid", label: "미납만" },
                  ]}
                />
              </label>

              <div className="mt-5 border-t border-line pt-5">
                <p className="text-xs font-bold text-t2">공과금 표시</p>
                <div className="mt-3 space-y-3">
                  {UTILITY_OPTIONS.map(({ type, label }) => (
                    <Checkbox
                      key={type}
                      label={label}
                      checked={utilitySelection[type]}
                      onChange={(event) => setUtilitySelection((current) => ({
                        ...current,
                        [type]: event.target.checked,
                      }))}
                    />
                  ))}
                </div>
              </div>
            </aside>

            <main className="min-h-0 overflow-auto bg-slate-200/70 p-5">
              {isError ? (
                <div className="flex min-h-80 items-center justify-center text-sm font-bold text-red">
                  수납명세서 자료를 불러오지 못했습니다.
                </div>
              ) : isLoading ? (
                <div className="flex min-h-80 items-center justify-center"><Spinner /></div>
              ) : statementRows.length === 0 ? (
                <div className="flex min-h-80 items-center justify-center text-sm text-t3">
                  검색 결과가 없습니다.
                </div>
              ) : (
                preview
              )}
            </main>
          </div>

          <footer className="flex items-center justify-between border-t border-line px-5 py-3">
            <p className="text-xs text-t3">
              {scopeLabel} · {statementRows.length.toLocaleString("ko-KR")}건
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
              <Button
                type="button"
                onClick={() => window.print()}
                disabled={isLoading || isError || statementRows.length === 0}
              >
                인쇄
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {!isLoading && !isError && statementRows.length > 0 && (
        <div className="hidden print:block" data-testid="payment-statement-print-root">
          {preview}
        </div>
      )}
    </>
  );
}
