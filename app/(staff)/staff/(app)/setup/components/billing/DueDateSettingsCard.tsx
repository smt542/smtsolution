import { CustomDropdown, Panel, SegmentedControl } from "@/components/common";

/** 납부일 선택값: "" = 설정 안 함(그 달 말일), "1"~"28", "31" = 말일. */
export type DueDayValue = string;
export type DueMonthOffset = "0" | "1";

type DueDateSettingsCardProps = {
  monthOffset: DueMonthOffset;
  dueDay: DueDayValue;
  onMonthOffsetChange: (value: DueMonthOffset) => void;
  onDueDayChange: (value: DueDayValue) => void;
};

const MONTH_OPTIONS = [
  { value: "0", label: "당월" },
  { value: "1", label: "익월" },
];

const DAY_OPTIONS = [
  { value: "", label: "설정 안 함" },
  ...Array.from({ length: 28 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}일` })),
  { value: "31", label: "말일" },
];

/** 예시: 이번 달 월분의 기본 납부일(설정 안 함이면 그 달 말일). */
function exampleText(monthOffset: DueMonthOffset, dueDay: DueDayValue): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based, 월분 = 이번 달
  const offset = dueDay === "" ? 0 : Number(monthOffset);
  const target = new Date(year, month + offset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = dueDay === "" ? lastDay : Math.min(Number(dueDay), lastDay);
  return `${year}년 ${month + 1}월분 → ${target.getFullYear()}.${String(target.getMonth() + 1).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

export function DueDateSettingsCard({
  monthOffset,
  dueDay,
  onMonthOffsetChange,
  onDueDayChange,
}: DueDateSettingsCardProps) {
  const unset = dueDay === "";

  return (
    <Panel
      title="납부기한"
      subtitle="건물·월별 납기일을 따로 정하지 않은 달에 쓰는 회사 기본 납부일이에요"
      variant="compact"
    >
      <div className="flex items-center gap-[16px]">
        <div className="min-w-0 flex-1">
          <div className="h-[16px] text-[14px] font-bold leading-[16px] text-t1">기본 납부일</div>
          <div className="pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">
            미납·연체료 계산과 세입자·현장 앱의 납부기한에 쓰여요. 설정하지 않으면 그 달 말일이에요.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[10px]">
          <SegmentedControl
            options={MONTH_OPTIONS}
            value={monthOffset}
            onChange={(value) => onMonthOffsetChange(value === "1" ? "1" : "0")}
            disabled={unset}
          />
          <CustomDropdown
            chevron="rotate"
            ariaLabel="기본 납부일"
            size="notification"
            variant="field"
            position="fixed"
            value={dueDay}
            onChange={onDueDayChange}
            options={DAY_OPTIONS}
            menuClassName="max-h-[280px] overflow-auto leading-[normal] [&.uc-dd-menu]:shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)] [&_.uc-opt]:px-[11px] [&_.uc-opt]:py-[9px] [&_.uc-opt.on]:bg-blue-t [&_.uc-opt.on]:text-blue"
          />
        </div>
      </div>
      <div className="mt-[12px] border-t border-line2 pt-[12px] text-[12.5px] font-semibold text-t2">
        예시 · {exampleText(monthOffset, dueDay)}
        {unset ? <span className="ml-[6px] font-medium text-t3">(그 달 말일)</span> : null}
      </div>
    </Panel>
  );
}
