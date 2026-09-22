import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";

interface GasBillingToolbarProps {
  buildingName: string;
  periodLabel: string;
  chargeStartDate: string;
  chargeEndDate: string;
  editing: boolean;
  pending?: boolean;
  onChargeStartDateChange: (value: string) => void;
  onChargeEndDateChange: (value: string) => void;
  onEdit: () => void;
  onCalculate: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function GasBillingToolbar({
  buildingName,
  periodLabel,
  chargeStartDate,
  chargeEndDate,
  editing,
  pending,
  onChargeStartDateChange,
  onChargeEndDateChange,
  onEdit,
  onCalculate,
  onSave,
  onCancel,
}: GasBillingToolbarProps) {
  return (
    <section className={`sticky top-0 z-[4] flex h-auto min-h-[52px] shrink-0 flex-wrap items-center gap-2.5 rounded-[12px] border bg-white px-[14px] py-[10px] shadow-[0_1px_3px_rgba(23,31,40,0.05)] min-[1101px]:h-[52px] ${editing ? "border-blue shadow-[0_0_0_3px_#E2F5F1]" : "border-line"}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-t1">{buildingName}</p>
        <p className="mt-px text-[11.5px] font-medium text-t3">{periodLabel} 부과 편집</p>
      </div>
      <div className="flex flex-wrap items-center gap-[6px]">
        <span className="mr-1 text-[11.5px] font-bold text-t2">부과기준일</span>
        <DpDatePicker ariaLabel="부과 시작일" disabled={!editing} value={chargeStartDate} onChange={onChargeStartDateChange} placeholder="시작일" />
        <span className="text-[12px] font-bold text-t2">~</span>
        <DpDatePicker ariaLabel="부과 종료일" disabled={!editing} value={chargeEndDate} onChange={onChargeEndDateChange} placeholder="종료일" />
        <span aria-hidden="true" className="flex items-start px-1"><span className="h-[26px] w-px bg-line" /></span>
        {editing ? (
          <>
            <Button size="sm" variant="ghost" type="button" onClick={onCalculate} disabled={pending} className="disabled:opacity-50">
              계산
            </Button>
            <button type="button" onClick={onSave} disabled={pending} className="h-[26px] rounded-[8px] bg-blue px-[10px] text-[11.5px] font-bold text-white hover:bg-blue-d disabled:opacity-50">
              저장
            </button>
            <button type="button" aria-label="수정 취소" onClick={onCancel} disabled={pending} className="flex size-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t3 hover:bg-bg disabled:opacity-50">
              <CloseIcon />
            </button>
          </>
        ) : (
          <Button variant="ghost" size="sm" type="button" onClick={onEdit}>
            수정
          </Button>
        )}
      </div>
    </section>
  );
}
