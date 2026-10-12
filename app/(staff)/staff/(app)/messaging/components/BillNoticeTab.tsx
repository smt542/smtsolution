"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox } from "@/components/common";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { currentPeriod } from "@/lib/billing/period";
import { formatWon } from "@/lib/format/number";
import { BILL_NOTICE_KIND_LABELS } from "@/lib/messaging/billNotice";
import { MessagingListCard } from "./MessagingListCard";
import { SelectMenu } from "./SelectMenu";
import { useBillNoticeSend } from "./useBillNoticeSend";

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-[#8b95a1] whitespace-nowrap";
const TD =
  "h-[47.8px] px-[16px] py-[12px] text-[13px] font-medium leading-[normal] text-[#191f28]";

/** 이번 달부터 과거 11개월(부과 확정 월만 대상이 나온다). */
function periodOptions(): { value: string; label: string }[] {
  const [year, month] = currentPeriod().split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, month - 1 - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    return { value, label: `${date.getFullYear()}년 ${date.getMonth() + 1}월분` };
  });
}

function amountText(value: number | undefined): string {
  return value === undefined ? "-" : formatWon(value);
}

/** 문자·알림톡 관리 「관리비 고지서」: 부과 확정 세대에 유형별 카카오 고지서(알림톡)를 발송한다. */
export function BillNoticeTab() {
  const { data: buildings = [] } = useBuildings();
  const [months] = useState(periodOptions);
  const [buildingKey, setBuildingKey] = useState("");
  const [period, setPeriod] = useState(() => months[0].value);
  // 기본 전부 체크 — 체크를 푼 세대만 기억한다(건물·월을 바꾸면 초기화).
  const [unchecked, setUnchecked] = useState<ReadonlySet<number>>(() => new Set());

  const buildingId = buildingKey ? Number(buildingKey) : null;
  const buildingName = buildings.find((building) => building.id === buildingId)?.name ?? "";
  const { rows, isLoading, error, refresh, blockers, isSending, send } =
    useBillNoticeSend(buildingId, buildingName, period);

  const buildingOptions = useMemo(
    () => [
      { value: "", label: "건물 선택" },
      ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
    ],
    [buildings],
  );
  const sendableRows = rows.filter((row) => row.excludeReasons.length === 0);
  const selectedIds = new Set(sendableRows.filter((row) => !unchecked.has(row.unitId)).map((row) => row.unitId));
  const allChecked = sendableRows.length > 0 && selectedIds.size === sendableRows.length;

  const toggle = (unitId: number) => {
    setUnchecked((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };
  const toggleAll = () => {
    setUnchecked(allChecked ? new Set(sendableRows.map((row) => row.unitId)) : new Set());
  };

  const handleSend = async () => {
    const done = await send(selectedIds);
    if (done) setUnchecked(new Set());
  };

  return (
    <MessagingListCard
      title="관리비 고지서"
      count={rows.length}
      refreshingLabel="고지 대상 갱신 중"
      isLoading={isLoading}
      loadingLabel="고지 대상 불러오는 중"
      error={error}
      errorMessage="고지 대상을 불러오지 못했습니다."
      onRetry={refresh}
      isEmpty={buildingId === null || rows.length === 0}
      emptyMessage={buildingId === null ? "건물을 선택해 주세요." : "이 달에 부과 확정된 입주 세대가 없습니다."}
      actions={
        <>
          <SelectMenu
            ariaLabel="건물"
            className="w-[200px]"
            value={buildingKey}
            options={buildingOptions}
            onChange={(value) => {
              setBuildingKey(value);
              setUnchecked(new Set());
            }}
          />
          <SelectMenu
            ariaLabel="월분"
            className="w-[150px]"
            value={period}
            options={months}
            onChange={(value) => {
              setPeriod(value);
              setUnchecked(new Set());
            }}
          />
          <Button
            type="button"
            disabled={isSending || isLoading || blockers.length > 0 || selectedIds.size === 0}
            onClick={() => void handleSend()}
          >
            {isSending ? "발송 중…" : `고지서 발송 ${selectedIds.size}`}
          </Button>
        </>
      }
    >
      {blockers.length > 0 ? (
        <div role="alert" className="border-b border-[#f1f3f5] px-[18px] py-[12px]">
          {blockers.map((message) => (
            <p key={message} className="text-[13px] font-semibold text-[#f04452]">{message}</p>
          ))}
        </div>
      ) : null}
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-[#e8ebee] bg-[#fbfcfd]">
            <th className={`${TH} w-[52px]`}>
              <Checkbox
                label=""
                aria-label="발송 가능 세대 전체 선택"
                checked={allChecked}
                disabled={sendableRows.length === 0}
                onChange={toggleAll}
              />
            </th>
            <th className={TH}>호수</th>
            <th className={TH}>입주자</th>
            <th className={TH}>고지 유형</th>
            <th className={`${TH} text-right`}>당월 관리비</th>
            <th className={`${TH} text-right`}>미납 관리비</th>
            <th className={`${TH} text-right`}>총 납부금액</th>
            <th className={TH}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sendable = row.excludeReasons.length === 0;
            const unitText = row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo;
            return (
              <tr key={row.unitId} className="border-b border-[#f1f3f5] last:border-b-0 hover:bg-row-hover-accent">
                <td className={TD}>
                  <Checkbox
                    label=""
                    aria-label={`${unitText} 선택`}
                    checked={sendable && selectedIds.has(row.unitId)}
                    disabled={!sendable || isSending}
                    onChange={() => toggle(row.unitId)}
                  />
                </td>
                <td className={TD}>{unitText}</td>
                <td className={TD}>{row.tenantName ?? "-"}</td>
                <td className={TD}>{BILL_NOTICE_KIND_LABELS[row.kind]}</td>
                <td className={`${TD} text-right`}>{amountText(row.amounts?.month)}</td>
                <td className={`${TD} text-right`}>{amountText(row.amounts?.unpaid)}</td>
                <td className={`${TD} text-right`}>{amountText(row.amounts?.total)}</td>
                <td className={TD}>
                  {sendable ? (
                    <span className="text-[#14a497]">발송 가능</span>
                  ) : (
                    <span className="text-[#8b95a1]">{row.excludeReasons.join(" · ")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </MessagingListCard>
  );
}
