"use client";

import { useMemo, useState } from "react";
import { Button, SegmentedControl, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import {
  useGiroPaymentDetails,
  useGiroPayments,
  type PaymentRow,
} from "@/hooks/reactquery/payments";
import { toMonthInput } from "@/lib/billing/period";
import { formatNumber } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import {
  giroEmptyClass,
  giroFooterClass,
  giroFooterDividerClass,
  giroFooterItemClass,
  giroFooterLabelClass,
  giroFooterUnitClass,
  giroFooterValueClass,
  giroGroupFirstClass,
  giroRightClass,
  giroSubtotalClass,
  giroTableClass,
  giroTdClass,
  giroThClass,
  giroWrapClass,
} from "./giroClasses";

interface GiroLedgerModalProps {
  open: boolean;
  buildingId: number | null;
  period: string;
  rows: (PaymentRow & { buildingName?: string | null })[];
  onClose: () => void;
}

type ErrorFilter = "all" | "normal" | "dup";

const dateOnly = (value: string) => (value ? value.slice(0, 10) : "");
const slashDate = (value: string) => dateOnly(value).replaceAll("-", "/");
const displayDate = (value: string) => value.replaceAll("-", ".");
const giroDateTriggerClassName =
  "box-border flex h-[36px] w-[132px] cursor-pointer items-center justify-start rounded-[10px] border border-line bg-surface px-[11px] text-[13px] font-semibold leading-[normal] text-t1 outline-none";
const giroDateTriggerOpenClassName =
  "border-brand shadow-[0_0_0_3px_var(--color-blue-t)]";

const GIRO_COLUMNS = [
  { label: "No", minWidth: "min-w-[48.59px]", right: true },
  { label: "지로일자", minWidth: "min-w-[112.69px]" },
  { label: "수납일", minWidth: "min-w-[107.36px]" },
  { label: "코드", minWidth: "min-w-[56.89px]" },
  { label: "건물명", minWidth: "min-w-[104px]" },
  { label: "호수", minWidth: "min-w-[56.89px]" },
  { label: "년월", minWidth: "min-w-[87.61px]" },
  { label: "수납액", minWidth: "min-w-[82px]", right: true },
  { label: "수수료", minWidth: "min-w-[63.13px]", right: true },
  { label: "실입금액", minWidth: "min-w-[84px]", right: true },
  { label: "부과금액", minWidth: "min-w-[84px]", right: true },
  { label: "에러", minWidth: "min-w-[78.67px]" },
  { label: "고객번호", minWidth: "min-w-[114.94px]" },
  { label: "수납구분", minWidth: "min-w-[113.69px]" },
  { label: "장표", minWidth: "min-w-[70px]" },
] as const;

function monthRange(period: string): { from: string; to: string } {
  const ym = period.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return { from: "", to: "" };
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(lastDay).padStart(2, "0")}` };
}

interface LedgerRow {
  id: number;
  giroDate: string;
  code: string;
  buildingName: string;
  unitNo: string;
  unitLabel: string;
  yearMonth: string;
  amount: number;
  fee: number;
  netAmount: number;
  charged: number | null;
  customerNo: string;
  isDup: boolean;
  matched: boolean;
}

interface GiroDateGroup {
  date: string;
  rows: LedgerRow[];
  subtotal: { amount: number; fee: number; netAmount: number };
}

export function GiroLedgerModal({
  open,
  buildingId,
  period,
  rows,
  onClose,
}: GiroLedgerModalProps) {
  const giroQuery = useGiroPayments(buildingId, period);
  const detailQuery = useGiroPaymentDetails(period);
  const initialRange = monthRange(period);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>("all");

  const unitMap = useMemo(() => {
    const map = new Map<number, (PaymentRow & { buildingName?: string | null })>();
    for (const row of rows) map.set(row.unitId, row);
    return map;
  }, [rows]);

  const detailMap = useMemo(
    () => new Map((detailQuery.data ?? []).map((detail) => [detail.id, detail])),
    [detailQuery.data],
  );

  const enriched = useMemo<LedgerRow[]>(() => {
    const active = (giroQuery.data ?? []).filter((row) => row.status === "active");
    const dupCount = new Map<string, number>();
    for (const row of active) {
      const key = `${row.unitId}|${row.amount}|${dateOnly(row.paidAt)}`;
      dupCount.set(key, (dupCount.get(key) ?? 0) + 1);
    }

    return active.map((row) => {
      const info = unitMap.get(row.unitId);
      const detail = detailMap.get(row.id);
      const dupKey = `${row.unitId}|${row.amount}|${dateOnly(row.paidAt)}`;
      const fee = detail?.fee ?? 0;
      return {
        id: row.id,
        giroDate: dateOnly(row.paidAt),
        code: detail?.buildingCode || "-",
        buildingName: row.buildingName || "-",
        unitNo: row.unitNo,
        unitLabel: row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo,
        yearMonth: toMonthInput(period),
        amount: row.amount,
        fee,
        netAmount: row.amount - fee,
        charged: info?.charged ?? null,
        customerNo: info?.payerNo || "-",
        isDup: (dupCount.get(dupKey) ?? 0) > 1,
        matched: Boolean(info),
      };
    });
  }, [detailMap, giroQuery.data, period, unitMap]);

  const filtered = useMemo(
    () =>
      enriched.filter((row) => {
        if (from && row.giroDate < from) return false;
        if (to && row.giroDate > to) return false;
        if (errorFilter === "normal" && row.isDup) return false;
        if (errorFilter === "dup" && !row.isDup) return false;
        return true;
      }),
    [enriched, from, to, errorFilter],
  );

  const groups = useMemo<GiroDateGroup[]>(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of filtered) {
      const list = map.get(row.giroDate) ?? [];
      list.push(row);
      map.set(row.giroDate, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, groupRows]) => {
        const sortedRows = [...groupRows].sort(
          (a, b) =>
            a.code.localeCompare(b.code, "ko-KR", { numeric: true })
            || a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true })
            || a.id - b.id,
        );
        return {
          date,
          rows: sortedRows,
          subtotal: sortedRows.reduce(
            (subtotal, row) => ({
              amount: subtotal.amount + row.amount,
              fee: subtotal.fee + row.fee,
              netAmount: subtotal.netAmount + row.netAmount,
            }),
            { amount: 0, fee: 0, netAmount: 0 },
          ),
        };
      });
  }, [filtered]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (total, row) => ({
          count: total.count + 1,
          amount: total.amount + row.amount,
          fee: total.fee + row.fee,
          netAmount: total.netAmount + row.netAmount,
        }),
        { count: 0, amount: 0, fee: 0, netAmount: 0 },
      ),
    [filtered],
  );

  const isError = giroQuery.isError || detailQuery.isError;
  const isLoading = !isError && (giroQuery.data === undefined || detailQuery.data === undefined);
  const errorTabs: { value: ErrorFilter; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "normal", label: "정상" },
    { value: "dup", label: "이중수납" },
  ];

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title="지로수납원장"
      subtitle="처리 완료된 지로 수납 내역이에요"
      look="canon-wide"
      footer={
        <>
          <div className={giroFooterClass}>
            <span className={giroFooterItemClass}>
              <i className={giroFooterLabelClass}>총건수</i>
              <b className={giroFooterValueClass}>{formatNumber(totals.count)}</b>
              <em className={giroFooterUnitClass}>건</em>
            </span>
            <span className={giroFooterDividerClass} />
            <span className={giroFooterItemClass}>
              <i className={giroFooterLabelClass}>총 수납액</i>
              <b className={giroFooterValueClass}>{formatNumber(totals.amount)}</b>
              <em className={giroFooterUnitClass}>원</em>
            </span>
            <span className={giroFooterDividerClass} />
            <span className={giroFooterItemClass}>
              <i className={giroFooterLabelClass}>총 수수료</i>
              <b className={giroFooterValueClass}>{formatNumber(totals.fee)}</b>
              <em className={giroFooterUnitClass}>원</em>
            </span>
            <span className={giroFooterDividerClass} />
            <span className={giroFooterItemClass}>
              <i className={giroFooterLabelClass}>총 실입금액</i>
              <b className={giroFooterValueClass}>{formatNumber(totals.netAmount)}</b>
              <em className={giroFooterUnitClass}>원</em>
            </span>
          </div>
          <div className="flex-1" />
          <Button type="button" size="modal" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </>
      }
    >
      <div className="mb-[12px] flex flex-none items-center gap-[8px] border-b border-line pb-[12px] leading-[normal]">
        <span className="mr-[2px] text-[13px] font-extrabold text-t2">조회일</span>
        <DpDatePicker
          ariaLabel="조회 시작일"
          value={from}
          onChange={setFrom}
          triggerClassName={giroDateTriggerClassName}
          triggerOpenClassName={giroDateTriggerOpenClassName}
          displayFormatter={displayDate}
        />
        <span className="text-[13px] font-bold text-t3">~</span>
        <DpDatePicker
          ariaLabel="조회 종료일"
          value={to}
          onChange={setTo}
          triggerClassName={giroDateTriggerClassName}
          triggerOpenClassName={giroDateTriggerOpenClassName}
          displayFormatter={displayDate}
        />
        <span className="ml-[14px] mr-[2px] text-[13px] font-extrabold text-t2">에러</span>
        <SegmentedControl
          size="sm"
          options={errorTabs}
          value={errorFilter}
          onChange={(value) => setErrorFilter(value as ErrorFilter)}
        />
      </div>

      <div className={giroWrapClass}>
        <table className={giroTableClass}>
          <thead>
            <tr>
              {GIRO_COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={`${giroThClass} ${column.minWidth} ${"right" in column && column.right ? giroRightClass : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isError ? (
              <tr>
                <td colSpan={15} role="alert" className={`${giroTdClass} !px-0 !py-[34px] text-center font-medium !text-red`}>
                  지로 수납 내역을 불러오지 못했어요
                </td>
              </tr>
            ) : isLoading ? (
              <tr>
                <td colSpan={15} className={`${giroTdClass} ${giroEmptyClass}`}>
                  <div className="flex justify-center"><Spinner /></div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={15} className={`${giroTdClass} ${giroEmptyClass}`}>
                  조회 결과가 없어요
                </td>
              </tr>
            ) : (
              groups.map((group, groupIndex) => (
                <GiroDateGroup
                  key={group.date}
                  date={group.date}
                  rows={group.rows}
                  subtotal={group.subtotal}
                  startNo={groups
                    .slice(0, groupIndex)
                    .reduce((sum, item) => sum + item.rows.length, 0)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </ComplaintDialog>
  );
}

function GiroDateGroup({
  date,
  rows,
  subtotal,
  startNo,
}: {
  date: string;
  rows: LedgerRow[];
  subtotal: GiroDateGroup["subtotal"];
  startNo: number;
}) {
  return (
    <>
      {rows.map((row, index) => {
        const cellClass = `${giroTdClass} ${index === 0 ? giroGroupFirstClass : ""}`;
        return (
          <tr key={row.id}>
            <td className={`${cellClass} ${giroRightClass} tabular-nums`}>{startNo + index + 1}</td>
            <td className={`${cellClass} tabular-nums`}>{index === 0 ? slashDate(date) : ""}</td>
            <td className={`${cellClass} tabular-nums`}>{slashDate(row.giroDate)}</td>
            <td className={cellClass}>{row.code}</td>
            <td className={cellClass}>{row.buildingName}</td>
            <td className={cellClass}>{row.unitLabel}</td>
            <td className={`${cellClass} tabular-nums`}>{row.yearMonth}</td>
            <td className={`${cellClass} ${giroRightClass} tabular-nums`}>{formatNumber(row.amount)}</td>
            <td className={`${cellClass} ${giroRightClass} tabular-nums`}>{formatNumber(row.fee)}</td>
            <td className={`${cellClass} ${giroRightClass} tabular-nums`}>{formatNumber(row.netAmount)}</td>
            <td className={`${cellClass} ${giroRightClass} tabular-nums`}>{formatNumber(row.charged)}</td>
            <td className={cellClass}>
              {row.isDup ? <span className="font-bold text-red">이중수납</span> : "정상"}
            </td>
            <td className={`${cellClass} tabular-nums`}>{row.customerNo}</td>
            <td className={cellClass}>-</td>
            <td className={cellClass}>
              {row.matched ? "정상" : <span className="font-bold text-red">비정상</span>}
            </td>
          </tr>
        );
      })}
      <tr>
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass} tabular-nums`}>{slashDate(date)}</td>
        <td colSpan={4} className={`${giroTdClass} ${giroSubtotalClass}`}>{rows.length}건</td>
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass} ${giroRightClass} tabular-nums`}>{formatNumber(subtotal.amount)}</td>
        <td className={`${giroTdClass} ${giroSubtotalClass} ${giroRightClass} tabular-nums`}>{formatNumber(subtotal.fee)}</td>
        <td className={`${giroTdClass} ${giroSubtotalClass} ${giroRightClass} tabular-nums`}>{formatNumber(subtotal.netAmount)}</td>
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
        <td className={`${giroTdClass} ${giroSubtotalClass}`} />
      </tr>
    </>
  );
}
