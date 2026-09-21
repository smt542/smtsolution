import { formatNumber } from "@/lib/format";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type {
  OverdueDisplayGroup,
  OverdueLineOverride,
} from "./buildOverdueGroups";
import { OVERDUE_COL, OVERDUE_HEADERS, OVERDUE_TABLE_WIDTH } from "./columns";
import { formatPeriodSlash } from "./format";

export type EditField = "unpaid" | "lateFee" | "postLate";

interface OverdueDetailTableProps {
  groups: OverdueDisplayGroup[];
  billerName: string;
  onEdit: (key: string, patch: OverdueLineOverride) => void;
}

const money = (value: number) => formatNumber(value, { nullText: "0" });

function HeaderCell({
  width,
  label,
  align,
}: {
  width: number;
  label: string;
  align: "left" | "right";
}) {
  return (
    <div
      style={{ width }}
      className={`flex h-[37px] shrink-0 items-center whitespace-nowrap px-[16px] text-[12px] font-medium text-t3 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {label}
    </div>
  );
}

function TextCell({
  width,
  value,
  align = "left",
  strong = false,
}: {
  width: number;
  value: string;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <div
      style={{ width }}
      className={`flex h-[50px] shrink-0 items-center px-[16px] text-[13px] tabular-nums ${
        align === "right" ? "justify-end" : "justify-start"
      } ${strong ? "font-semibold text-t1" : "text-t2"}`}
    >
      {value}
    </div>
  );
}

function AmountCell({
  width,
  value,
  ariaLabel,
  onChange,
}: {
  width: number;
  value: number;
  ariaLabel: string;
  onChange: (next: number) => void;
}) {
  return (
    <div
      style={{ width }}
      className="flex h-[50px] shrink-0 items-center justify-end px-[16px]"
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={money(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? 0 : Number(digits));
        }}
        className="h-[26px] w-[76px] rounded-[6px] border border-line bg-surface px-[8px] text-right text-[12px] tabular-nums text-t1 focus:border-teal focus:outline-none"
      />
    </div>
  );
}

/** 편집 불가 파생값(연체료계)을 입력칸과 같은 크기로, 시각만 읽기전용 표기. */
function DerivedAmountCell({ width, value }: { width: number; value: number }) {
  return (
    <div
      style={{ width }}
      className="flex h-[50px] shrink-0 items-center justify-end px-[16px]"
    >
      <span className="flex h-[26px] w-[76px] items-center justify-end rounded-[6px] border border-transparent px-[8px] text-right text-[12px] tabular-nums text-t2">
        {money(value)}
      </span>
    </div>
  );
}

function DetailRow({
  group,
  lineIndex,
  billerName,
  onEdit,
}: {
  group: OverdueDisplayGroup;
  lineIndex: number;
  billerName: string;
  onEdit: (key: string, patch: OverdueLineOverride) => void;
}) {
  const line = group.lines[lineIndex];
  const isFirst = lineIndex === 0;
  return (
    <div className="flex border-b border-line2 bg-surface">
      <TextCell width={OVERDUE_COL.unit} value={isFirst ? group.unitLabel : ""} strong />
      <TextCell width={OVERDUE_COL.biller} value={isFirst ? billerName : ""} />
      <TextCell width={OVERDUE_COL.period} value={formatPeriodSlash(line.period)} />
      <TextCell width={OVERDUE_COL.overdue} value={String(line.overdueMonths)} align="right" />
      <AmountCell
        width={OVERDUE_COL.unpaid}
        value={line.unpaid}
        ariaLabel={`${group.unitLabel} ${formatPeriodSlash(line.period)} 미납액`}
        onChange={(next) => onEdit(line.key, { unpaid: next })}
      />
      <AmountCell
        width={OVERDUE_COL.lateFee}
        value={line.displayLateFee}
        ariaLabel={`${group.unitLabel} ${formatPeriodSlash(line.period)} 납.연체료`}
        onChange={(next) => onEdit(line.key, { lateFee: next })}
      />
      <AmountCell
        width={OVERDUE_COL.postLate}
        value={line.postLate}
        ariaLabel={`${group.unitLabel} ${formatPeriodSlash(line.period)} 납.후연체`}
        onChange={(next) => onEdit(line.key, { postLate: next })}
      />
      <DerivedAmountCell width={OVERDUE_COL.lateTotal} value={line.lateTotal} />
      <TextCell width={OVERDUE_COL.total} value={money(line.total)} align="right" strong />
      <div
        style={{ width: OVERDUE_COL.note }}
        className="flex h-[50px] shrink-0 items-center px-[16px]"
      >
        <input
          type="text"
          aria-label={`${group.unitLabel} ${formatPeriodSlash(line.period)} 비고`}
          value={line.note}
          onChange={(event) => onEdit(line.key, { note: event.target.value })}
          className="h-[26px] w-[120px] rounded-[6px] border border-line bg-surface px-[8px] text-[12px] text-t1 focus:border-teal focus:outline-none"
        />
      </div>
      <div
        style={{ width: OVERDUE_COL.phone }}
        className="flex h-[50px] shrink-0 items-center px-[16px] text-[13px] tabular-nums text-t2"
      >
        {isFirst && group.phone ? (
          <MaskedPhone
            value={group.phone}
            kind="phone"
            reveal={{ targetKind: "occupancy", targetId: group.occupancyId, field: "phone" }}
          />
        ) : (
          ""
        )}
      </div>
      <TextCell width={OVERDUE_COL.name} value={isFirst ? group.tenantName ?? "" : ""} />
    </div>
  );
}

/** [호합] 롤업 행 — Figma상 동호(724px) 영역 안에 요약 숫자를 배치. */
function SummaryRow({ group }: { group: OverdueDisplayGroup }) {
  const { rollup } = group;
  const cells: { label: string; value: number; width: number }[] = [
    { label: "미납액", value: rollup.unpaid, width: 78 },
    { label: "납.연체료", value: rollup.lateFee, width: 66 },
    { label: "납.후연체", value: rollup.postLate, width: 50 },
    { label: "연체료계", value: rollup.lateTotal, width: 66 },
    { label: "합계", value: rollup.total, width: 82 },
  ];
  return (
    <div className="flex border-b border-line bg-[#fbfcfd]">
      <div
        style={{ width: OVERDUE_COL.unit }}
        className="flex h-[41px] shrink-0 items-center gap-[10px] pl-[84px]"
      >
        <span className="w-[52px] text-[12px] font-bold text-t3">[호합]</span>
        {cells.map((cell) => (
          <span
            key={cell.label}
            style={{ width: cell.width }}
            className="text-right text-[12px] font-semibold tabular-nums text-t1"
          >
            {money(cell.value)}
          </span>
        ))}
      </div>
      <div className="flex-1" />
    </div>
  );
}

export function OverdueDetailTable({ groups, billerName, onEdit }: OverdueDetailTableProps) {
  return (
    <div className="w-max min-w-full" style={{ minWidth: OVERDUE_TABLE_WIDTH }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex border-b border-line bg-[#f7f9fa]">
        {OVERDUE_HEADERS.map((header) => (
          <HeaderCell
            key={header.key}
            width={OVERDUE_COL[header.key]}
            label={header.label}
            align={header.align}
          />
        ))}
      </div>

      {/* 동호별: 부과월 상세행 + [호합] 롤업행 */}
      {groups.map((group) => (
        <div key={group.occupancyId}>
          {group.lines.map((line, index) => (
            <DetailRow
              key={line.key}
              group={group}
              lineIndex={index}
              billerName={billerName}
              onEdit={onEdit}
            />
          ))}
          <SummaryRow group={group} />
        </div>
      ))}
    </div>
  );
}
