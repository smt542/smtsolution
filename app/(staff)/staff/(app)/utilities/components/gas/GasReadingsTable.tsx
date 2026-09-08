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
  ["호수", 59], ["입주일자", 115], ["퇴실일자", 112], ["퇴실예정일자", 115],
  ["전월", 88], ["금월", 88], ["량", 115], ["전.량", 56], ["증감", 53],
  ["수동입력", 115], ["할인유형", 90], ["할인금액", 75], ["부과액", 71],
  ["적요", 152], ["처리일자", 112], ["부과기준", 197], ["이름", 67],
  ["전화", 137], ["라인", 53], ["인원", 53],
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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold text-t1">호실별 가스 지침</h2>
        <div className="ml-auto flex items-center gap-4 text-[11.5px] font-medium text-t3">
          <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-blue" />퇴실 예정</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-red" />공실 사용량</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-[3px] rounded-full bg-green" />최근 입주</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-[1922px] table-fixed border-collapse text-center">
          <colgroup>
            {COLUMNS.map(([heading, width]) => <col key={heading} style={{ width }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 h-[37px] bg-[#fbfcfd] text-[11px] font-bold text-t3">
            <tr className="border-b border-line">
              {COLUMNS.map(([heading]) => <th key={heading} className="border-r border-line2 last:border-r-0">{heading}</th>)}
            </tr>
          </thead>
          <tbody className="text-[11.5px] font-semibold text-t2">
            {rows.map((row, index) => {
              const draft = drafts[row.unitId];
              const current = numberFrom(draft.currentReading);
              const usage = row.fixedUsage ?? (current === null || row.previousReading === null ? row.usage : Math.max(0, current - row.previousReading));
              const previousUsage = row.usage;
              const change = usage === null || previousUsage === null ? null : usage - previousUsage;
              const manual = numberFrom(draft.manualCharge);
              const charge = manual ?? row.automaticCharge ?? (usage === null ? null : usage * (row.resolvedUnitPrice ?? 0));
              const vacantUsage = (row.occupancyStatus === "vacant" || row.occupancyId === null) && (usage ?? 0) > 0;
              const marker = row.occupancyStatus === "moving_out" ? "border-l-[3px] border-l-blue" : vacantUsage ? "border-l-[3px] border-l-red" : isRecent(row.moveInDate, referenceDate) ? "border-l-[3px] border-l-green" : "";
              return (
                <tr key={row.unitId} className={`h-[51px] border-b border-line2 ${marker} hover:bg-[#fbfcfd]`}>
                  <td className="font-extrabold text-t1">{row.unitNo}</td>
                  <td>{shortDate(row.moveInDate)}</td>
                  <td>-</td>
                  <td>{row.occupancyStatus === "moving_out" ? "예정" : "-"}</td>
                  <td className="tabular-nums">
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 전월 지침값`}
                        value={row.previousReading === null ? "" : String(row.previousReading)}
                        readOnly
                        onChange={() => {}}
                      />
                    ) : format(row.previousReading)}
                  </td>
                  <td>
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 당월 지침값`}
                        value={draft.currentReading}
                        disabled={row.fixedUsage !== null}
                        onChange={(value) => onDraftChange(row.unitId, { currentReading: value })}
                      />
                    ) : format(row.currentReading)}
                  </td>
                  <td className="tabular-nums">
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
                  <td className="tabular-nums">{format(previousUsage)}</td>
                  <td className={`tabular-nums ${change !== null && change > 0 ? "text-red" : ""}`}>{format(change)}</td>
                  <td>
                    {editing ? (
                      <ReadingInput
                        label={`${row.unitNo} 수동 입력 요금`}
                        value={draft.manualCharge}
                        onChange={(value) => onDraftChange(row.unitId, { manualCharge: value })}
                      />
                    ) : format(row.manualCharge)}
                  </td>
                  <td>{row.discountType ?? "-"}</td>
                  <td className="tabular-nums text-red">{row.discountAmount ? `-${format(row.discountAmount)}` : "-"}</td>
                  <td className="tabular-nums">{format(charge)}</td>
                  <td className="px-2">
                    {editing ? (
                      <input aria-label={`${row.unitNo} 적요`} value={draft.note} onChange={(event) => onDraftChange(row.unitId, { note: event.target.value })} className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-left text-[11.5px] outline-none" />
                    ) : row.note ?? "-"}
                  </td>
                  <td>{shortDate(row.processedAt)}</td>
                  <td className="text-[10.5px] text-t3">{chargeStartDate} ~ {chargeEndDate}</td>
                  <td>{row.tenantName ?? "공실"}</td>
                  <td>-</td>
                  <td>{index + 1}</td>
                  <td>-</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex h-[220px] w-full items-center justify-center text-[12px] text-t3">등록된 호실이 없습니다.</div>
        )}
      </div>
    </section>
  );
}
