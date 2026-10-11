import { Input } from "@/components/common";
import type { GasTableRow, GasUtilityDraft } from "./types";
import { GridEmptyValue } from "../GridEmptyValue";
import { UtilityGrid, type UtilityGridColumn } from "../UtilityGrid";
import {
  FIXED_LOCK_CELL,
  LockedValue,
  LockPin,
  manualLockPatch,
  usageFromReadings,
  usageTextFromReadings,
  usageLockPatch,
} from "../UtilityLock";

interface GasReadingsTableProps {
  rows: GasTableRow[];
  drafts: Record<number, GasUtilityDraft>;
  editing: boolean;
  referenceDate: string;
  chargeStartDate: string;
  chargeEndDate: string;
  onDraftChange: (unitId: number, patch: Partial<GasUtilityDraft>) => void;
}

const TABLE_WIDTH = 1922;

function numberFrom(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function format(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

function ReadingValue({ value }: { value: number | null }) {
  return value === null ? <GridEmptyValue /> : format(value);
}

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10) : "-";
}

function isRecent(moveInDate: string | null, referenceDate: string): boolean {
  if (!moveInDate) return false;
  const from = new Date(moveInDate).getTime();
  const to = new Date(referenceDate).getTime();
  return to >= from && to - from <= 31 * 24 * 60 * 60 * 1000;
}

interface GasReadingsGridRow {
  row: GasTableRow;
  draft: GasUtilityDraft;
  /** 지침으로 계산한 량. 량을 고정하면 이 값이 고정값이 된다. */
  computedUsage: number | null;
  usage: number | null;
  previousUsage: number | null;
  change: number | null;
  charge: number | null;
  vacant: boolean;
  vacantUsage: boolean;
  movingOut: boolean;
  recent: boolean;
  marker: string;
  chargeBasis: string;
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
    <Input
      unstyled
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
}: GasReadingsTableProps) {
  const chargeBasis = `${chargeStartDate.replaceAll("-", ".")} ~ ${chargeEndDate.replaceAll("-", ".")}`;
  const preparedRows: GasReadingsGridRow[] = rows.map((row) => {
    const draft = drafts[row.unitId] ?? {
      previousReading: row.previousReading === null ? "" : String(row.previousReading),
      currentReading: row.currentReading === null ? "" : String(row.currentReading),
      usage: row.usage === null ? "" : String(row.usage),
      usageEdited: false,
      manualCharge: "",
      note: "",
      usageLocked: false,
      lockedUsage: "",
      manualLocked: false,
    };
    const computedUsage = usageFromReadings(draft.previousReading, draft.currentReading, true);
    // 고정한 량은 지침과 무관하게 그 값으로 부과된다(서버 save_meter_readings 도 같다).
    const usage = draft.usageLocked
      ? numberFrom(draft.lockedUsage)
      : draft.usageEdited ? numberFrom(draft.usage) : computedUsage;
    const previousUsage = row.usage;
    const change = usage === null || previousUsage === null ? null : usage - previousUsage;
    const manual = numberFrom(draft.manualCharge);
    const charge = manual ?? row.automaticCharge ?? (usage === null ? null : usage * (row.resolvedUnitPrice ?? 0));
    const vacant = row.occupancyStatus === "vacant" || row.occupancyId === null;
    const vacantUsage = vacant && (usage ?? 0) > 0;
    const movingOut = row.occupancyStatus === "moving_out";
    const recent = isRecent(row.moveInDate, referenceDate);
    const marker = movingOut
      ? "shadow-[inset_3px_0_0_#3182F6]"
      : vacantUsage
        ? "shadow-[inset_3px_0_0_#F04452]"
        : recent
          ? "shadow-[inset_3px_0_0_#12B886]"
          : "";

    return { row, draft, computedUsage, usage, previousUsage, change, charge, vacant, vacantUsage, movingOut, recent, marker, chargeBasis };
  });

  const columns: UtilityGridColumn<GasReadingsGridRow>[] = [
    {
      key: "unitNo",
      label: "호수",
      width: 59,
      align: "left",
      cellClassName: (item) => `${item.marker} font-bold text-t1`,
      render: (item) => item.row.unitNo,
    },
    {
      key: "moveInDate",
      label: "입주일자",
      width: 115,
      align: "left",
      cellClassName: (item) => item.recent ? "font-semibold text-green" : "",
      render: (item) => formatDate(item.row.moveInDate),
    },
    {
      key: "moveOutDate",
      label: "퇴실일자",
      width: 112,
      align: "left",
      cellClassName: "text-t3",
      render: () => "-",
    },
    {
      key: "moveOutScheduledDate",
      label: "퇴실예정일자",
      width: 115,
      align: "left",
      cellClassName: (item) => item.movingOut ? "text-blue2" : "text-t3",
      render: (item) => item.movingOut ? "예정" : "-",
    },
    {
      key: "previousReading",
      label: "전월",
      width: 88,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => editing ? (
        <ReadingInput
          label={`${item.row.unitNo} 전월 지침값`}
          value={item.draft.previousReading}
          onChange={(value) => onDraftChange(item.row.unitId, {
            previousReading: value,
            ...(!item.draft.usageEdited ? { usage: usageTextFromReadings(value, item.draft.currentReading, true) } : {}),
          })}
        />
      ) : <ReadingValue value={item.row.previousReading} />,
    },
    {
      key: "currentReading",
      label: "금월",
      width: 88,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => editing ? (
        <ReadingInput
          label={`${item.row.unitNo} 당월 지침값`}
          value={item.draft.currentReading}
          disabled={item.draft.usageLocked}
          onChange={(value) => onDraftChange(item.row.unitId, {
            currentReading: value,
            ...(!item.draft.usageEdited ? { usage: usageTextFromReadings(item.draft.previousReading, value, true) } : {}),
          })}
        />
      ) : <ReadingValue value={item.row.currentReading} />,
    },
    {
      key: "usage",
      label: "량",
      width: 115,
      align: "right",
      cellClassName: (item) => `tabular-nums ${!editing && item.draft.usageLocked ? FIXED_LOCK_CELL : ""}`,
      render: (item) => editing ? (
        <div className="flex items-center justify-center gap-[5px]">
          <ReadingInput
            label={`${item.row.unitNo} 사용량`}
            value={item.draft.usageLocked ? item.draft.lockedUsage : item.draft.usage}
            readOnly={item.draft.usageLocked}
            onChange={(value) => onDraftChange(item.row.unitId, { usage: value, usageEdited: true })}
          />
          <LockPin
            locked={item.draft.usageLocked}
            label={`${item.row.unitNo} 량 고정`}
            onToggle={() => onDraftChange(item.row.unitId, {
              ...usageLockPatch(item.draft.usageLocked, item.usage),
              ...(item.draft.usageLocked ? {
                usageEdited: false,
                usage: usageTextFromReadings(item.draft.previousReading, item.draft.currentReading, true),
              } : {}),
            })}
          />
        </div>
      ) : item.draft.usageLocked ? <LockedValue value={item.usage} /> : <ReadingValue value={item.usage} />,
    },
    {
      key: "previousUsage",
      label: "전.량",
      width: 56,
      align: "right",
      cellClassName: "tabular-nums",
      render: (item) => <ReadingValue value={item.previousUsage} />,
    },
    {
      key: "change",
      label: "증감",
      width: 53,
      align: "right",
      cellClassName: (item) => `tabular-nums ${item.change !== null && item.change > 0 ? "text-red" : ""}`,
      render: (item) => <ReadingValue value={item.change} />,
    },
    {
      key: "manualCharge",
      label: "수동입력",
      width: 115,
      align: "right",
      cellClassName: (item) => `tabular-nums ${!editing && item.draft.manualLocked ? FIXED_LOCK_CELL : ""}`,
      render: (item) => editing ? (
        <div className="flex items-center justify-center gap-[5px]">
          <ReadingInput
            label={`${item.row.unitNo} 수동 입력 요금`}
            value={item.draft.manualCharge}
            readOnly={item.draft.manualLocked}
            onChange={(value) => onDraftChange(item.row.unitId, { manualCharge: value })}
          />
          <LockPin
            locked={item.draft.manualLocked}
            label={`${item.row.unitNo} 수동입력 고정`}
            onToggle={() => onDraftChange(item.row.unitId, manualLockPatch(item.draft.manualLocked, item.draft.manualCharge))}
          />
        </div>
      ) : item.draft.manualLocked ? <LockedValue value={numberFrom(item.draft.manualCharge)} /> : <ReadingValue value={item.row.manualCharge} />,
    },
    {
      key: "discountType",
      label: "할인유형",
      width: 90,
      align: "left",
      cellClassName: "",
      render: (item) => item.row.discountType || <GridEmptyValue />,
    },
    {
      key: "discountAmount",
      label: "할인금액",
      width: 75,
      align: "right",
      cellClassName: "tabular-nums text-red",
      render: (item) => item.row.discountAmount ? `-${format(item.row.discountAmount)}` : "-",
    },
    {
      key: "charge",
      label: "부과액",
      width: 71,
      align: "right",
      cellClassName: "font-semibold tabular-nums",
      render: (item) => <ReadingValue value={item.charge} />,
    },
    {
      key: "note",
      label: "적요",
      width: 152,
      align: "left",
      cellClassName: "",
      render: (item) => editing ? (
        <Input
          unstyled
          aria-label={`${item.row.unitNo} 적요`}
          value={item.draft.note}
          onChange={(event) => onDraftChange(item.row.unitId, { note: event.target.value })}
          className="h-[26px] w-full rounded-[7px] border border-teal bg-white px-2 text-left text-[11.5px] outline-none"
        />
      ) : item.row.note ? (
        <span className="block w-full min-w-0 truncate" title={item.row.note}>{item.row.note}</span>
      ) : <GridEmptyValue />,
    },
    {
      key: "processedAt",
      label: "처리일자",
      width: 112,
      align: "left",
      cellClassName: "",
      render: (item) => item.row.processedAt ? formatDate(item.row.processedAt) : <GridEmptyValue />,
    },
    {
      key: "chargeBasis",
      label: "부과기준",
      width: 197,
      align: "left",
      cellClassName: "",
      render: (item) => item.chargeBasis,
    },
    {
      key: "tenantName",
      label: "이름",
      width: 67,
      align: "left",
      cellClassName: "",
      render: (item) => item.row.tenantName ?? "공실",
    },
    {
      key: "phone",
      label: "전화",
      width: 137,
      align: "left",
      cellClassName: "text-t3",
      render: () => <GridEmptyValue />,
    },
    {
      key: "line",
      label: "라인",
      width: 53,
      align: "right",
      cellClassName: "tabular-nums",
      render: (_item, index) => index + 1,
    },
    {
      key: "residentCount",
      label: "인원",
      width: 53,
      align: "right",
      cellClassName: "tabular-nums",
      render: () => <GridEmptyValue />,
    },
  ];

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
      <UtilityGrid
        columns={columns}
        rows={preparedRows}
        rowKey={(item) => item.row.unitId}
        editing={editing}
        layout="fixed"
        tableWidth={TABLE_WIDTH}
        rowClassName={(item) => `bg-white hover:bg-row-hover ${item.vacant && !item.vacantUsage ? "opacity-55" : ""}`}
        empty={<div className="flex h-[220px] w-full items-center justify-center text-[13px] text-t3">등록된 호실이 없어요.</div>}
        className="min-h-0 flex-1"
      />
    </section>
  );
}
