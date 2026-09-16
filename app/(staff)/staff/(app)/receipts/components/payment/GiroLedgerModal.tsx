"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, Spinner } from "@/components/common";
import {
  usePaymentRows,
  useGiroPayments,
  type PaymentRow,
} from "@/hooks/reactquery/payments";
import { formatNumber } from "@/lib/format";
import { toMonthInput } from "@/lib/billing/period";
import { ComplaintDialog } from "../ComplaintDialog";

interface GiroLedgerModalProps {
  open: boolean;
  buildingId: number;
  buildingName: string;
  period: string;
  onClose: () => void;
}

type ErrorFilter = "all" | "normal" | "dup";

const dateOnly = (value: string) => (value ? value.slice(0, 10) : "");
const slashDate = (value: string) => dateOnly(value).replaceAll("-", "/");

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
  unitLabel: string;
  amount: number;
  charged: number;
  customerNo: string;
  isDup: boolean;
  matched: boolean;
}

export function GiroLedgerModal({
  open,
  buildingId,
  buildingName,
  period,
  onClose,
}: GiroLedgerModalProps) {
  const { data: giro = [], isLoading } = useGiroPayments(buildingId, period);
  const { data: paymentRows = [] } = usePaymentRows(buildingId, period);
  const initialRange = monthRange(period);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [errorFilter, setErrorFilter] = useState<ErrorFilter>("all");

  const unitMap = useMemo(() => {
    const map = new Map<string, PaymentRow>();
    for (const row of paymentRows) map.set(`${row.dong ?? ""}|${row.unitNo}`, row);
    return map;
  }, [paymentRows]);

  const enriched = useMemo<LedgerRow[]>(() => {
    const active = giro.filter((row) => row.status === "active");
    const dupCount = new Map<string, number>();
    for (const row of active) {
      const key = `${row.dong ?? ""}|${row.unitNo}|${row.amount}|${dateOnly(row.paidAt)}`;
      dupCount.set(key, (dupCount.get(key) ?? 0) + 1);
    }
    return active.map((row, index) => {
      const info = unitMap.get(`${row.dong ?? ""}|${row.unitNo}`);
      const dupKey = `${row.dong ?? ""}|${row.unitNo}|${row.amount}|${dateOnly(row.paidAt)}`;
      return {
        id: row.id,
        giroDate: dateOnly(row.paidAt),
        code: String(index + 1).padStart(3, "0"),
        unitLabel: row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo,
        amount: row.amount,
        charged: info?.charged ?? row.amount,
        customerNo: info?.payerNo ?? "-",
        isDup: (dupCount.get(dupKey) ?? 0) > 1,
        matched: Boolean(info),
      };
    });
  }, [giro, unitMap]);

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

  const groups = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const row of filtered) {
      const list = map.get(row.giroDate) ?? [];
      list.push(row);
      map.set(row.giroDate, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({
        date,
        rows: list,
        sub: list.reduce(
          (acc, row) => ({ amount: acc.amount + row.amount }),
          { amount: 0 },
        ),
      }));
  }, [filtered]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => ({
          count: acc.count + 1,
          amount: acc.amount + row.amount,
        }),
        { count: 0, amount: 0 },
      ),
    [filtered],
  );

  const yearMonth = toMonthInput(period);
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
      size="wide"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-t3">
            <span>총건수 <strong className="num text-t1">{formatNumber(totals.count)}</strong>건</span>
            <span className="text-line">|</span>
            <span>총 수납액 <strong className="num text-t1">{formatNumber(totals.amount)}</strong>원</span>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-t2">조회일</span>
        <input
          type="date"
          aria-label="조회 시작일"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-t1 focus:border-brand focus:outline-none"
        />
        <span className="text-xs text-t3">~</span>
        <input
          type="date"
          aria-label="조회 종료일"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-t1 focus:border-brand focus:outline-none"
        />
        <span className="ml-2 text-xs font-bold text-t2">에러</span>
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-bold">
          {errorTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setErrorFilter(tab.value)}
              className={`rounded-md px-2.5 py-1 ${
                errorFilter === tab.value ? "bg-blue text-white" : "text-t3"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        {isLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState message="지로 수납 내역이 없습니다" />
        ) : (
          <table className="w-full min-w-[900px] text-[11px]">
            <thead>
              <tr className="border-b border-line bg-bg text-left font-bold text-t3">
                <th className="px-2 py-2 text-right">No</th>
                <th className="px-2 py-2">지로일자</th>
                <th className="px-2 py-2">수납일</th>
                <th className="px-2 py-2">코드</th>
                <th className="px-2 py-2">건물명</th>
                <th className="px-2 py-2">호수</th>
                <th className="px-2 py-2">년월</th>
                <th className="px-2 py-2 text-right">수납액</th>
                <th className="px-2 py-2 text-right">부과금액</th>
                <th className="px-2 py-2">에러</th>
                <th className="px-2 py-2">고객번호</th>
                <th className="px-2 py-2">수납구분</th>
                <th className="px-2 py-2">장표</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) => (
                <GiroDateGroup
                  key={group.date}
                  date={group.date}
                  rows={group.rows}
                  sub={group.sub}
                  startNo={groups
                    .slice(0, groupIndex)
                    .reduce((sum, item) => sum + item.rows.length, 0)}
                  yearMonth={yearMonth}
                  buildingName={buildingName}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ComplaintDialog>
  );
}

function GiroDateGroup({
  date,
  rows,
  sub,
  startNo,
  yearMonth,
  buildingName,
}: {
  date: string;
  rows: LedgerRow[];
  sub: { amount: number };
  startNo: number;
  yearMonth: string;
  buildingName: string;
}) {
  return (
    <>
      {rows.map((row, index) => (
        <tr key={row.id} className="border-b border-line text-t2">
          <td className="num px-2 py-1.5 text-right">{startNo + index + 1}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{slashDate(row.giroDate)}</td>
          {/* 수납일: 서버에서 지로일자/수납일 분리 전까지 동일 표기(TODO backend). */}
          <td className="whitespace-nowrap px-2 py-1.5">{slashDate(row.giroDate)}</td>
          <td className="px-2 py-1.5">{row.code}</td>
          <td className="whitespace-nowrap px-2 py-1.5 text-t1">{buildingName}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.unitLabel}</td>
          <td className="whitespace-nowrap px-2 py-1.5">{yearMonth}</td>
          <td className="num px-2 py-1.5 text-right text-t1">{formatNumber(row.amount)}</td>
          <td className="num px-2 py-1.5 text-right">{formatNumber(row.charged)}</td>
          <td className="px-2 py-1.5">
            {row.isDup ? (
              <span className="font-bold text-red">이중수납</span>
            ) : (
              <span className="text-t3">정상</span>
            )}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5">{row.customerNo}</td>
          <td className="whitespace-nowrap px-2 py-1.5">인터넷지로</td>
          <td className="px-2 py-1.5">{row.matched ? "정상" : "비정상"}</td>
        </tr>
      ))}
      <tr className="border-b border-line bg-bg font-bold text-t1">
        <td className="px-2 py-1.5" />
        <td className="whitespace-nowrap px-2 py-1.5">{slashDate(date)}</td>
        <td className="px-2 py-1.5">{rows.length}건</td>
        <td className="px-2 py-1.5" colSpan={4} />
        <td className="num px-2 py-1.5 text-right">{formatNumber(sub.amount)}</td>
        <td className="px-2 py-1.5" colSpan={5} />
      </tr>
    </>
  );
}
