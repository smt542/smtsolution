import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";

interface ElectricityPeriodBarProps {
  buildingName: string | null;
  period: string;
  startDate: string;
  endDate: string;
  editing: boolean;
  saving?: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onEdit: () => void;
  onCalculate: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ElectricityPeriodBar({
  buildingName,
  period,
  startDate,
  endDate,
  editing,
  saving = false,
  onStartDateChange,
  onEndDateChange,
  onEdit,
  onCalculate,
  onSave,
  onCancel,
}: ElectricityPeriodBarProps) {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5, 7));

  return (
    <section className={`sticky top-0 z-[4] flex min-h-[52px] flex-none flex-wrap items-center gap-[10px] rounded-[12px] border bg-white px-[14px] py-[10px] drop-shadow-[0px_1px_1.5px_rgba(23,31,40,0.05)] ${editing ? "border-blue shadow-[0_0_0_3px_#E2F5F1]" : "border-line"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold leading-[normal] text-t1">
          {buildingName ?? "건물 미선택"}
        </p>
        <p className="mt-px text-[11.5px] font-medium leading-[normal] text-t3">
          {year}년 {month}월분 부과 편집
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-[6px]">
        <span className="whitespace-nowrap text-[11.5px] font-bold text-t2">부과기준일</span>
        <DpDatePicker ariaLabel="부과 시작일" disabled={!editing} value={startDate} onChange={onStartDateChange} placeholder="시작일" />
        <span className="text-[12px] font-bold text-t2">~</span>
        <DpDatePicker ariaLabel="부과 종료일" disabled={!editing} value={endDate} onChange={onEndDateChange} placeholder="종료일" />
      </div>

      <div aria-hidden="true" className="flex items-start px-[4px]">
        <span className="h-[26px] w-px bg-line" />
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onCalculate}
          >
            계산
          </Button>
          {/* 정본은 저장 중에도 버튼 모양·문구가 그대로다. disabled는 두 번 저장만 막는다. */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-[26px] rounded-[8px] border border-blue bg-blue px-[10px] text-[11.5px] font-bold text-white hover:bg-blue-d"
          >
            저장
          </button>
          <button
            type="button"
            aria-label="수정 취소"
            onClick={onCancel}
            className="flex size-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t3 hover:bg-bg hover:text-t1"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>
      ) : (
        // 정본처럼 건물 미선택이어도 평소 모양 그대로 두고, 누르면 아무 동작을 하지 않는다.
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={buildingName ? onEdit : undefined}
        >
          수정
        </Button>
      )}
    </section>
  );
}
