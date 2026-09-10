import Image from "next/image";
import type { GasTableRow, GasUtilityDraft } from "./types";

interface GasReadingsTableProps {
  rows: GasTableRow[];
  drafts: Record<number, GasUtilityDraft>;
  editing: boolean;
  referenceDate: string;
  chargeStartDate: string;
  chargeEndDate: string;
  onDraftChange: (unitId: number, patch: Partial<GasUtilityDraft>) => void;
  onOpenFixedUsage: (row: GasTableRow) => void;
}

const COLUMNS = [
  { heading: "호수", width: 59, align: "left" },
  { heading: "입주일자", width: 115, align: "left" },
  { heading: "퇴실일자", width: 112, align: "left" },
  { heading: "퇴실예정일자", width: 115, align: "left" },
  { heading: "전월", width: 88, align: "right" },
  { heading: "금월", width: 88, align: "right" },
  { heading: "량", width: 115, align: "right" },
  { heading: "전.량", width: 56, align: "right" },
  { heading: "증감", width: 53, align: "right" },
  { heading: "수동입력", width: 115, align: "right" },
  { heading: "할인유형", width: 90, align: "left" },
  { heading: "할인금액", width: 75, align: "right" },
  { heading: "부과액", width: 71, align: "right" },
  { heading: "적요", width: 152, align: "left" },
  { heading: "처리일자", width: 112, align: "left" },
  { heading: "부과기준", width: 197, align: "left" },
  { heading: "이름", width: 67, align: "left" },
  { heading: "전화", width: 137, align: "left" },
  { heading: "라인", width: 53, align: "right" },
  { heading: "인원", width: 53, align: "right" },
] as const;

function numberFrom(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function format(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function shortDate(value: string | null): string {
  return value ? value.slice(0, 10).slice(2).replaceAll("-", ".") : "-";
}

function isRecent(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate) return false;
  const from = new Date(moveInDate).getTime();
  const to = new Date(referenceDate).getTime();
  return to >= from && to - from <= 31 * 24 * 60 * 60 * 1000;
}

function ReadingInput({
  label,
  value,
  disabled,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      value={value}
      disabled={disabled}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className="h-[26px] w-14 rounded-[7px] border border-teal bg-white px-1.5 text-right text-[11.5px] font-semibold tabular-nums text-t2 outline-none disabled:border-line disabled:bg-bg disabled:text-t4"
    />
  );
}

export function GasReadingsTable({
  rows,
  drafts,
  editing,
  referenceDate,
  chargeStartDate,
  chargeEndDate,
  onDraftChange,
  onOpenFixedUsage,
}: GasReadingsTableProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold text-t1">호실별 가스 지침</h2>
        <div className="ml-auto flex items-center gap-4 text-[11.5px] font-medium text-t3">
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-blue2" />퇴실 예정</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-red" />공실 사용량</span>
          <span className="flex items-center gap-[5px]"><i className="h-3 w-[3px] rounded-[2px] bg-green" />최근 입주</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-[1922px] table-fixed border-collapse text-center">
          <colgroup>
            {COLUMNS.map(({ heading, width }) => <col key={heading} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 h-[37px] bg-[#FBFCFD] text-[12px] font-bold text-t3">
            <tr className="border-b border-line">
              {COLUMNS.map(({ heading, align }) => (
                <th key={heading} className={`border-r border-line2 px-4 last:border-r-0 ${align === "right" ? "text-right" : "text-left"}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[13.5px] font-medium text-t1">
            {rows.map((row, index) => {
              const draft = drafts[row.unitId];
              const current = numberFrom(draft.currentReading);
              const usage = row.fixedUsage ?? (current === null || row.previousReading === null ? row.usage : Math.max(0, current - row.previousReading));
              const previousUsage = row.usage;
              const change = usage === null || previousUsage === null ? null : usage - previousUsage;
              const manual = numberFrom(draft.manualCharge);
              const charge = manual ?? row.automaticCharge ?? (usage === null ? null : usage * (row.resolvedUnitPrice ?? 0));
              const vacantUsage = (row.occupancyStatus === "vacant" || row.occupancyId === null) && (usage ?? 0) > 0;
              const marker = row.occupancyStatus === "moving_out"
                ? "shadow-[inset_3px_0_0_#3182F6]"
                : vacantUsage
                  ? "shadow-[inset_3px_0_0_#F04452]"
                  : isRecent(row.moveInDate, referenceDate)
                    ? "shadow-[inset_3px_0_0_#12B886]"
                    : "";
              return (
                <tr key={row.unitId} className={`${editing ? "h-[51px]" : "h-[41px]"} border-b border-line2 hover:bg-[#FBFCFD] [&_td]:px-4 ${(row.occupancyStatus === "vacant" || row.occupancyId === null) && !vacantUsage ? "opacity-55" : ""}`}>
                  <td className={`text-left font-bold text-t1 ${marker}`}>{row.unitNo}</td>
                  <td className={`text-left ${isRecent(row.moveInDate, referenceDate) ? "font-semibold text-green" : ""}`}>{shortDate(row.moveInDate)}</td>
                  <td className="text-left text-t3">-</td>
                  <td className={`text-left ${row.occupancyStatus === "moving_out" ? "text-blue2" : "text-t3"}`}>{row.occupancyStatus === "moving_out" ? "예정" : "-"}</td>
                  <td className="text-right tabular-nums">
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 전월 지침값`}
                        value={row.previousReading === null ? "" : String(row.previousReading)}
                        readOnly
                        onChange={() => {}}
                      />
                    ) : format(row.previousReading)}
                  </td>
                  <td className="text-right">
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 당월 지침값`}
                        value={draft.currentReading}
                        disabled={row.fixedUsage !== null}
                        onChange={(value) => onDraftChange(row.unitId, { currentReading: value })}
                      />
                    ) : format(row.currentReading)}
                  </td>
                  <td className="text-right tabular-nums">
                    {editing ? (
                      <div className="flex items-center justify-center gap-[5px]">
                        <ReadingInput
                          label={`${row.unitNo} 사용량`}
                          value={usage === null ? "" : String(usage)}
                          readOnly
                          onChange={() => {}}
                        />
                        <button type="button" aria-label={`${row.unitNo} 고정 사용량 설정`} onClick={() => onOpenFixedUsage(row)} className="flex size-[22px] items-center justify-center rounded-md border border-line bg-white hover:bg-bg">
                          <Image src="/figma-assets/gas/lock.svg" alt="" width={12} height={12} />
                        </button>
                      </div>
                    ) : format(usage)}
                  </td>
                  <td className="text-right tabular-nums">{format(previousUsage)}</td>
                  <td className={`text-right tabular-nums ${change !== null && change > 0 ? "text-red" : ""}`}>{format(change)}</td>
                  <td className="text-right">
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 수동 입력 요금`}
                        value={draft.manualCharge}
                        onChange={(value) => onDraftChange(row.unitId, { manualCharge: value })}
                      />
                    ) : format(row.manualCharge)}
                  </td>
                  <td className="text-left">{row.discountType ?? "-"}</td>
                  <td className="text-right tabular-nums text-red">{row.discountAmount ? `-${format(row.discountAmount)}` : "-"}</td>
                  <td className="text-right font-semibold tabular-nums">{format(charge)}</td>
                  <td className="px-2 text-left">
                    {editing ? (
                      <input aria-label={`${row.unitNo} 적요`} value={draft.note} onChange={(event) => onDraftChange(row.unitId, { note: event.target.value })} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-left text-[11.5px] outline-none" />
                    ) : row.note ?? "-"}
                  </td>
                  <td className="text-left">{shortDate(row.processedAt)}</td>
                  <td className="text-left text-[10.5px] text-t3">{chargeStartDate.replaceAll("-", ".")} ~ {chargeEndDate.replaceAll("-", ".")}</td>
                  <td className="text-left">{row.tenantName ?? "공실"}</td>
                  <td className="text-left text-t3">-</td>
                  <td className="text-right">{index + 1}</td>
                  <td className="text-right">-</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex h-[220px] w-full items-center justify-center text-[13px] text-t3">등록된 호실이 없어요.</div>
        )}
      </div>
    </section>
  );
}
