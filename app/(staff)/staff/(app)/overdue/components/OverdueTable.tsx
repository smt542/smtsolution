import { PhoneText } from "@/components/common";
import {
  buildOverdueGroups,
  formatOverduePeriod,
  formatOverdueUnit,
  sumOverdueGroups,
} from "./overdueRowModel";
import type { OverdueHousehold, OverduePeriodRow } from "@/hooks/reactquery/overdue";

interface OverdueTableProps {
  rows: OverdueHousehold[];
  periods?: OverduePeriodRow[];
  selectedIds?: Set<number>;
  onToggleOne?: (occupancyId: number) => void;
  onToggleAll?: () => void;
}

// 정본 `#ovBody` 표 헤더의 min-width/width 를 그대로 옮겼다. 정본은 table-layout:auto 라
// 이 값들이 하한이고 남는 폭은 자동 분배된다 — table-fixed + % 로 바꾸면 컬럼이 넓어져
// "연체" 헤더가 줄바꿈되고 가로 스크롤이 과도해진다.
const COLUMNS = [
  { label: "동호", align: "text-left", width: "min-w-[82px]" },
  { label: "거래처명", align: "text-left", width: "min-w-[96px]" },
  { label: "년월", align: "text-left", width: "w-[74px]" },
  { label: "연체", align: "text-right", width: "w-[46px]" },
  { label: "미납액", align: "text-right", width: "min-w-[82px]" },
  { label: "납.연체료", align: "text-right", width: "min-w-[82px]" },
  { label: "납.후연체", align: "text-right", width: "min-w-[82px]" },
  { label: "연체료계", align: "text-right", width: "min-w-[82px]" },
  { label: "합계", align: "text-right", width: "min-w-[88px]" },
  { label: "비고", align: "text-left", width: "min-w-[130px]" },
  { label: "전화", align: "text-left", width: "min-w-[118px]" },
  { label: "이름", align: "text-left", width: "min-w-[72px]" },
] as const;

const money = new Intl.NumberFormat("ko-KR");

export function OverdueTable({ rows, periods = [] }: OverdueTableProps) {
  const groups = buildOverdueGroups(rows, periods);
  const {
    lineCount: itemCount,
    principal: principalTotal,
    lateFee: lateFeeTotal,
    postDueFee: postDueTotal,
  } = sumOverdueGroups(groups);

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-b-[16px] bg-white">
      {/* 표를 칸 높이만큼 채워 합계행(항목 N / M건)을 행이 적어도 바닥에 둔다. 남는 높이는 아래 빈 채움 행이
          가져가도록 다른 행은 모두 높이를 고정한다. 행이 많으면 채움 행은 0이 되고 sticky 합계행이 바닥에 붙는다. */}
      <table className="h-full w-full whitespace-nowrap border-separate border-spacing-0 text-[13.5px] text-t1">
        <thead className="sticky top-0 z-20 bg-[#f7f9fa] text-[11.5px] font-medium text-t3">
          <tr className="h-[36.5px]">
            {COLUMNS.map(({ label, align, width }) => (
              <th
                key={label}
                scope="col"
                className={`h-[36.5px] border-b border-line bg-[#f7f9fa] px-[16px] font-medium ${align} ${width}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const unit = formatOverdueUnit(group.household);
            return [
              ...group.lines.map((line, index) => (
                <tr
                  key={line.key}
                  className="h-[41px] cursor-pointer bg-white transition hover:bg-row-hover"
                >
                  <td className="border-b border-line2 px-[16px] font-medium">{index === 0 ? unit : ""}</td>
                  <td className="border-b border-line2 px-[16px]">{index === 0 ? group.household.buildingName : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">{line.period === "-" ? "-" : formatOverduePeriod(line.period)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{line.months}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.principal)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.postDueFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee + line.postDueFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right font-medium num">{money.format(line.principal + line.lateFee + line.postDueFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-t3">{index === 0 ? group.household.memo ?? group.household.unitMemo ?? "" : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">
                    {index === 0 && group.household.phone ? (
                      <PhoneText value={group.household.phone} />
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="border-b border-line2 px-[16px]">{index === 0 ? group.household.tenantName ?? "미등록" : ""}</td>
                </tr>
              )),
              <tr key={`${group.household.occupancyId}:subtotal`} className="h-[41px] bg-white font-semibold">
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]">[호합]</td>
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.principal)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.lateFee)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.postDueFee)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.lateFee + group.postDueFee)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.principal + group.lateFee + group.postDueFee)}</td>
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
              </tr>,
            ];
          })}
          <tr aria-hidden="true">
            <td colSpan={COLUMNS.length} className="p-0" />
          </tr>
        </tbody>
        <tfoot className="sticky bottom-0 z-20 bg-[#f7f9fa] font-bold text-t1">
          <tr className="h-[38.5px]">
            <th scope="row" colSpan={3} className="rounded-bl-[16px] border-t border-line bg-[#f7f9fa] px-[16px] text-left">
              항목 {itemCount} / {rows.length}건
            </th>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(principalTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(lateFeeTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(postDueTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(lateFeeTotal + postDueTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(principalTotal + lateFeeTotal + postDueTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="rounded-br-[16px] border-t border-line bg-[#f7f9fa] px-[16px]" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
