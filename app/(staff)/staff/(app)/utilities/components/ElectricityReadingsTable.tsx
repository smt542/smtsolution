import Image from "next/image";
import type { UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";
import { GridEmptyValue } from "./GridEmptyValue";

export interface ElectricityDraft {
  currentReading: string;
  manualCharge: string;
  note: string;
}

interface ElectricityReadingsTableProps {
  rows: UtilityUnitRow[];
  drafts: Record<number, ElectricityDraft>;
  referenceDate: string;
  utilityLabel?: string;
  editing: boolean;
  onDraftChange: (unitId: number, patch: Partial<ElectricityDraft>) => void;
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNewOccupancy(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate || !referenceDate) return false;
  const moveIn = Date.parse(`${moveInDate}T00:00:00`);
  const reference = Date.parse(`${referenceDate}T00:00:00`);
  return !Number.isNaN(moveIn) && !Number.isNaN(reference)
    && Math.abs(reference - moveIn) <= 31 * 24 * 60 * 60 * 1000;
}

function inputClass(): string {
  return "num h-[26px] rounded-[7px] border border-teal bg-white px-[7px] text-right text-[11.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t3";
}

export function ElectricityReadingsTable({
  rows,
  drafts,
  referenceDate,
  utilityLabel = "전기",
  editing,
  onDraftChange,
}: ElectricityReadingsTableProps) {
  return (
    <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-card bg-white shadow-card">
      <div className="flex h-[49px] flex-none items-center gap-2.5 border-b border-line2 px-[18px]">
        <h2 className="whitespace-nowrap text-[15px] font-extrabold text-t1">호실별 {utilityLabel} 지침</h2>
        <div className="flex-1" />
        <div className="ml-3 flex items-center gap-3 whitespace-nowrap text-[11.5px] font-medium text-t3">
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 pb-14 pt-12 text-center">
          <p className="text-[16px] font-semibold tracking-[-0.02em] text-t1">건물을 선택해 주세요</p>
          <p className="text-[13px] font-normal leading-[1.55] text-t3">선택한 건물의 고객번호가 여기에 표시돼요</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className={`table-fixed border-collapse text-[11.5px] ${editing ? "w-[1922px]" : "w-[1722px]"}`}>
            <colgroup>
              {(editing
                ? [59, 115, 112, 115, 88, 88, 115, 56, 53, 115, 90, 76, 71, 152, 112, 197, 67, 137, 53, 53]
                : [59, 115, 112, 115, 57, 59, 49, 56, 53, 74, 90, 76, 71, 120, 112, 197, 67, 137, 53, 53]
              ).map((width, index) => <col key={index} style={{ width }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#fbfcfd] text-[12px] font-bold text-t3">
              <tr className="h-[36px] border-b border-line2">
                <th className="w-[59px] px-4 text-left">호수</th>
                <th className="w-[115px] px-4 text-left">입주일자</th>
                <th className="w-[112px] px-4 text-left">퇴실일자</th>
                <th className="w-[115px] px-4 text-left">퇴실예정일자</th>
                <th className={editing ? "w-[88px] px-4 text-right" : "w-[57px] px-4 text-right"}>전월</th>
                <th className={editing ? "w-[88px] px-4 text-right" : "w-[59px] px-4 text-right"}>금월</th>
                <th className={editing ? "w-[115px] px-4 text-right" : "w-[49px] px-4 text-right"}>량</th>
                <th className="w-[56px] px-4 text-right">전.량</th>
                <th className="w-[53px] px-4 text-right">증감</th>
                <th className={editing ? "w-[115px] px-4 text-right" : "w-[74px] px-4 text-right"}>수동입력</th>
                <th className="w-[90px] px-4 text-left">할인유형</th>
                <th className="w-[76px] px-4 text-right">할인금액</th>
                <th className="w-[72px] px-4 text-right">부과액</th>
                <th className={editing ? "w-[152px] px-4 text-left" : "w-[120px] px-4 text-left"}>적요</th>
                <th className="w-[112px] px-4 text-left">처리일자</th>
                <th className="w-[197px] px-4 text-left">부과기준</th>
                <th className="w-[67px] px-4 text-left">이름</th>
                <th className="w-[137px] px-4 text-left">전화</th>
                <th className="w-[53px] px-4 text-left">라인</th>
                <th className="w-[53px] px-4 text-right">인원</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = drafts[row.unitId] ?? { currentReading: "", manualCharge: "", note: "" };
                const current = optionalNumber(draft.currentReading) ?? row.currentReading;
                const usage = current !== null && row.previousReading !== null
                  ? current - row.previousReading
                  : row.usage;
                const invalidUsage = row.needsReview || (
                  current !== null
                  && row.previousReading !== null
                  && current - row.previousReading < 0
                );
                const vacant = row.occupancyStatus === "vacant" || row.occupancyId === null;
                const moving = row.occupancyStatus === "moving_out";
                const recent = !vacant && isNewOccupancy(row.moveInDate, referenceDate);
                const charge = optionalNumber(draft.manualCharge) ?? row.manualCharge ?? row.automaticCharge;
                const marker = moving
                  ? "shadow-[inset_3px_0_0_#3182F6]"
                  : vacant && (usage ?? 0) > 0
                    ? "shadow-[inset_3px_0_0_#F04452]"
                    : recent
                      ? "shadow-[inset_3px_0_0_#12B886]"
                      : "";

                return (
                  <tr key={row.unitId} className={`${editing ? "h-[51px]" : "h-[41px]"} border-b border-line2 bg-white hover:bg-[#FBFCFD] ${vacant && (usage ?? 0) <= 0 ? "opacity-55" : ""}`}>
                    <td className={`px-4 font-bold text-t1 ${marker}`}>{row.unitNo.replace(/호$/, "")}</td>
                    <td className={`px-4 ${row.moveInDate ? (recent ? "font-semibold text-green" : "text-t2") : ""}`}>{row.moveInDate ?? <GridEmptyValue />}</td>
                    <td className="px-4"><GridEmptyValue /></td>
                    <td className="px-4"><GridEmptyValue /></td>
                    <td className="px-4 text-right text-t2">
                      {editing ? <input aria-label={`${row.unitNo} 전월 지침값`} readOnly value={row.previousReading ?? ""} placeholder="-" className={`${inputClass()} w-full`} /> : row.previousReading === null ? <GridEmptyValue /> : <span className="num">{formatNumber(row.previousReading)}</span>}
                    </td>
                    <td className="px-4 text-right text-t1">
                      {editing ? (
                        <input
                          aria-label={`${row.unitNo} 당월 지침값`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.currentReading}
                          placeholder="-"
                          onChange={(event) => onDraftChange(row.unitId, { currentReading: event.target.value })}
                          className={`${inputClass()} w-full`}
                        />
                      ) : current === null ? <GridEmptyValue /> : <span className="num font-semibold">{formatNumber(current)}</span>}
                    </td>
                    <td className={`px-4 text-right font-semibold ${invalidUsage || (vacant && (usage ?? 0) > 0) ? "text-red" : "text-t1"}`}>
                      {invalidUsage ? (
                        <span className="text-red">확인 필요</span>
                      ) : editing ? (
                        <span className="flex items-center gap-[5px]">
                          <input aria-label={`${row.unitNo} 사용량`} readOnly value={usage ?? ""} placeholder="-" className={`${inputClass()} w-[56px]`} />
                          <span className="flex size-[22px] flex-none items-center justify-center"><Image src="/figma-assets/gas/lock.svg" alt="잠금" width={12} height={12} /></span>
                        </span>
                      ) : usage === null ? <GridEmptyValue /> : <span className="num">{formatNumber(usage)}</span>}
                    </td>
                    <td className="num px-4 text-right"><GridEmptyValue /></td>
                    <td className="num px-4 text-right"><GridEmptyValue /></td>
                    <td className="px-4 text-right">
                      {editing ? (
                        <span className="flex items-center gap-[5px]">
                          <input
                            aria-label={`${row.unitNo} 수동 입력 요금`}
                            type="number"
                            min="0"
                            value={draft.manualCharge}
                            onChange={(event) => onDraftChange(row.unitId, { manualCharge: event.target.value })}
                            className={`${inputClass()} w-[56px]`}
                          />
                          <span className="flex size-[22px] flex-none items-center justify-center"><Image src="/figma-assets/gas/lock.svg" alt="잠금" width={12} height={12} /></span>
                        </span>
                      ) : row.manualCharge === null ? <GridEmptyValue /> : <span className="num text-t2">{formatNumber(row.manualCharge)}</span>}
                    </td>
                    <td className={`px-4 ${row.discountType === null ? "" : "text-t2"}`}>{row.discountType ?? <GridEmptyValue />}</td>
                    <td className="num px-4 text-right text-t2">{row.discountAmount === null ? <GridEmptyValue /> : formatNumber(row.discountAmount)}</td>
                    <td className="num px-4 text-right font-semibold text-t1">{charge === null ? <GridEmptyValue /> : formatNumber(charge)}</td>
                    <td className="px-4 text-t2">
                      {editing ? (
                        <input
                          aria-label={`${row.unitNo} 적요`}
                          value={draft.note}
                          onChange={(event) => onDraftChange(row.unitId, { note: event.target.value })}
                          className={`${inputClass()} w-full text-left`}
                        />
                      ) : (row.note ?? <GridEmptyValue />)}
                    </td>
                    <td className="px-4 text-t3">{row.processedAt?.slice(0, 10) ?? <GridEmptyValue />}</td>
                    <td className="truncate px-4 text-t3">{row.unitPrice !== null ? `단가 ${formatNumber(row.unitPrice, { fractionDigits: 1 })}` : "단가 미설정"}</td>
                    <td className="truncate px-4 text-t2">{row.tenantName ?? <GridEmptyValue />}</td>
                    <td className="px-4"><GridEmptyValue /></td>
                    <td className="truncate px-4 text-t2">{row.customerNumber ?? <GridEmptyValue />}</td>
                    <td className="num px-4 text-right"><GridEmptyValue /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
