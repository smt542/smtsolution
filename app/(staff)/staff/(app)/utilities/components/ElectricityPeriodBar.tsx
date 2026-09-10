import { CloseIcon } from "@/components/icons";

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

function dateLabel(value: string): string {
  return value ? value.replaceAll("-", ".") : "-";
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
  const disabled = !buildingName;

  return (
    <section className={`sticky top-0 z-[4] flex min-h-[52px] flex-none flex-wrap items-center gap-2.5 rounded-[12px] border bg-white px-[14px] py-[10px] shadow-[0_1px_3px_rgba(23,31,40,0.05)] ${editing ? "border-blue shadow-[0_0_0_3px_#E2F5F1]" : "border-line"}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[12.5px] font-bold leading-[15px] ${disabled ? "text-t3" : "text-t1"}`}>
          {buildingName ?? "건물 미선택"}
        </p>
        <p className="mt-px text-[11.5px] font-medium leading-[14px] text-t3">
          {year}년 {month}월분 부과 편집
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 whitespace-nowrap text-[11.5px] font-bold text-t2">부과기준일</span>
        {editing ? (
          <>
            <input
              aria-label="부과 시작일"
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="h-[28px] w-[128px] rounded-[8px] border border-line bg-white px-[10px] text-center text-[12px] font-medium text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
            />
            <span className="text-xs text-t3">~</span>
            <input
              aria-label="부과 종료일"
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="h-[28px] w-[128px] rounded-[8px] border border-line bg-white px-[10px] text-center text-[12px] font-medium text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
            />
            <button
              type="button"
              onClick={onCalculate}
              className="h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg"
            >
              계산
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="h-[26px] rounded-[8px] bg-blue px-[10px] text-[11.5px] font-bold text-white hover:bg-blue-d disabled:opacity-60"
            >
              {saving ? "저장 중" : "저장"}
            </button>
            <button
              type="button"
              aria-label="수정 취소"
              onClick={onCancel}
              className="flex size-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t3 hover:bg-bg hover:text-t1"
            >
              <CloseIcon className="size-4" />
            </button>
          </>
        ) : (
          <>
            <div className={`flex h-[28px] min-w-[106px] items-center justify-center rounded-[8px] border px-[10px] text-[12px] font-medium ${disabled || !startDate ? "border-line2 bg-bg text-t4" : "border-line2 bg-bg text-t1"}`}>
              {disabled || !startDate ? "시작일" : dateLabel(startDate)}
            </div>
            <span className="text-xs text-t3">~</span>
            <div className={`flex h-[28px] min-w-[106px] items-center justify-center rounded-[8px] border px-[10px] text-[12px] font-medium ${disabled || !endDate ? "border-line2 bg-bg text-t4" : "border-line2 bg-bg text-t1"}`}>
              {disabled || !endDate ? "종료일" : dateLabel(endDate)}
            </div>
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled}
              className="h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg disabled:cursor-default disabled:bg-line2 disabled:text-t4"
            >
              수정
            </button>
          </>
        )}
      </div>
    </section>
  );
}
