import { CloseIcon } from "@/components/icons";

interface GasBillingToolbarProps {
  buildingName: string;
  periodLabel: string;
  chargeStartDate: string;
  chargeEndDate: string;
  editing: boolean;
  pending?: boolean;
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
  onEdit,
  onCalculate,
  onSave,
  onCancel,
}: GasBillingToolbarProps) {
  return (
    <section className={`flex h-[52px] shrink-0 items-center rounded-xl bg-white px-[14px] shadow-card ${editing ? "border border-teal" : "border border-line"}`}>
      <div className="min-w-[150px]">
        <p className="truncate text-[12.5px] font-extrabold text-t1">{buildingName}</p>
        <p className="mt-0.5 text-[11.5px] font-medium text-t3">{periodLabel} 가스 지침</p>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <span className="text-[11.5px] font-bold text-t2">부과기간</span>
        <div className={`flex h-7 w-[106px] items-center rounded-lg border px-2 text-[11.5px] font-semibold tabular-nums ${editing ? "border-line bg-white text-t2" : "border-line2 bg-bg text-t3"}`}>
          {chargeStartDate}
        </div>
        <span className="text-[11px] text-t4">~</span>
        <div className={`flex h-7 w-[106px] items-center rounded-lg border px-2 text-[11.5px] font-semibold tabular-nums ${editing ? "border-line bg-white text-t2" : "border-line2 bg-bg text-t3"}`}>
          {chargeEndDate}
        </div>
        {editing ? (
          <>
            <button type="button" onClick={onCalculate} disabled={pending} className="h-[26px] rounded-lg border border-line bg-white px-3 text-[11.5px] font-bold text-t2 hover:bg-bg disabled:opacity-50">
              계산
            </button>
            <button type="button" onClick={onSave} disabled={pending} className="h-[26px] rounded-lg bg-teal px-3 text-[11.5px] font-bold text-white hover:bg-teal-d disabled:opacity-50">
              저장
            </button>
            <button type="button" aria-label="수정 취소" onClick={onCancel} disabled={pending} className="flex size-[26px] items-center justify-center rounded-lg border border-line bg-white text-t3 hover:bg-bg disabled:opacity-50">
              <CloseIcon />
            </button>
          </>
        ) : (
          <button type="button" onClick={onEdit} className="h-[26px] rounded-lg border border-line bg-white px-3 text-[11.5px] font-bold text-t2 hover:bg-bg">
            수정
          </button>
        )}
      </div>
    </section>
  );
}
