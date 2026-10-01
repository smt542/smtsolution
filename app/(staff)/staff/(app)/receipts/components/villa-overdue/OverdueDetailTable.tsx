import { formatNumber } from "@/lib/format";
import { Input } from "@/components/common";
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
      className={`flex shrink-0 items-center whitespace-nowrap bg-[#f7f9fa] px-[16px] py-[11px] text-[11.5px] font-medium leading-[normal] text-t3 ${
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
}: {
  width: number;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div
      style={{ width }}
      className={`flex h-[50px] shrink-0 items-center px-[16px] py-[12px] text-[13.5px] font-medium leading-[normal] tabular-nums text-t1 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
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
      className="flex h-[50px] shrink-0 items-center justify-end px-[16px] py-[12px]"
    >
      <Input
        unstyled
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={money(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? 0 : Number(digits));
        }}
        className="h-[26px] w-[76px] rounded-[7px] border border-line bg-surface px-[7px] text-right text-[12.5px] font-medium tabular-nums text-t1 outline-none focus:border-teal focus:ring-[3px] focus:ring-teal-t"
      />
    </div>
  );
}


function DetailRow({
  group,
  lineIndex,
  isEven,
  billerName,
  onEdit,
}: {
  group: OverdueDisplayGroup;
  lineIndex: number;
  isEven: boolean;
  billerName: string;
  onEdit: (key: string, patch: OverdueLineOverride) => void;
}) {
  const line = group.lines[lineIndex];
  const isFirst = lineIndex === 0;
  return (
    <div
      className={`flex border-b border-line2 ${isEven ? "bg-[#fcfdfd]" : "bg-surface"} hover:bg-row-hover-accent`}
    >
      <TextCell width={OVERDUE_COL.unit} value={isFirst ? group.unitLabel : ""} />
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
      {/* 정본 up-in data-k="feeSum": 연체료계도 직접 고칠 수 있다(feeSumFix). */}
      <AmountCell
        width={OVERDUE_COL.lateTotal}
        value={line.lateTotal}
        ariaLabel={`${group.unitLabel} ${formatPeriodSlash(line.period)} 연체료계`}
        onChange={(next) => onEdit(line.key, { lateTotal: next })}
      />
      <TextCell width={OVERDUE_COL.total} value={money(line.total)} align="right" />
      <div
        style={{ width: OVERDUE_COL.note }}
        className="flex h-[50px] shrink-0 items-center px-[16px] py-[12px]"
      >
        <Input
          unstyled
          type="text"
          aria-label={`${group.unitLabel} ${formatPeriodSlash(line.period)} 비고`}
          value={line.note}
          onChange={(event) => onEdit(line.key, { note: event.target.value })}
          className="h-[26px] w-[120px] rounded-[7px] border border-line bg-surface px-[7px] text-left text-[12.5px] font-medium text-t1 outline-none focus:border-teal focus:ring-[3px] focus:ring-teal-t"
        />
      </div>
      <div
        style={{ width: OVERDUE_COL.phone }}
        className="flex h-[50px] shrink-0 items-center px-[16px] py-[12px] text-[13.5px] font-medium leading-[normal] tabular-nums text-t1"
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

/** 정본 `.up-tbl tr.up-sub` 롤업 행 — Figma상 동호(724px) 영역 안에 요약 숫자를 배치. */
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
    <div className="flex border-b border-line bg-transparent">
      <div
        style={{ width: OVERDUE_COL.unit }}
        className="flex shrink-0 items-center gap-[10px] py-[12px] pl-[84px]"
      >
        <span className="w-[52px] text-[13.5px] font-semibold leading-[normal] text-t1">[호합]</span>
        {cells.map((cell) => (
          <span
            key={cell.label}
            style={{ width: cell.width }}
            className="text-right text-[13.5px] font-semibold leading-[normal] tabular-nums text-t1"
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
      {/* 정본 `.up-tbl thead th`의 글자·배경·패딩 규격을 div 그리드에 맞춘다. */}
      <div className="sticky top-0 z-10 flex border-b border-line">
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
      {groups.map((group, groupIndex) => {
        const groupStartIndex = groups
          .slice(0, groupIndex)
          .reduce((total, previousGroup) => total + previousGroup.lines.length, 0);
        return (
          <div key={group.occupancyId}>
            {group.lines.map((line, index) => (
              <DetailRow
                key={line.key}
                group={group}
                lineIndex={index}
                isEven={(groupStartIndex + index) % 2 === 1}
                billerName={billerName}
                onEdit={onEdit}
              />
            ))}
            <SummaryRow group={group} />
          </div>
        );
      })}
    </div>
  );
}
