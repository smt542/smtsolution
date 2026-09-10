import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";

export function SettlementBasicSection({
  moveOutDate,
  onMoveOutDateChange,
}: {
  moveOutDate: string;
  onMoveOutDateChange: (date: string) => void;
}) {
  const day = Number(moveOutDate.slice(8, 10)) || 0;

  return (
    <section className="grid grid-cols-3 gap-[11px] rounded-[14px] border border-[#dce1e7] px-[16px] pb-[16px] pt-[15px]">
      <label>
        <span className="mb-[7px] block text-[12px] font-bold text-t2">
          퇴실일자<span className="text-red">*</span>
        </span>
        <DpDatePicker
          ariaLabel="퇴실일자"
          value={moveOutDate}
          onChange={onMoveOutDateChange}
          placeholder="날짜 선택"
          className="w-full"
          triggerClassName="flex h-[38px] w-full cursor-pointer items-center justify-between gap-[6px] rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-[13.5px] font-semibold text-t1 outline-none"
          triggerOpenClassName="!border-teal ring-[3px] ring-teal-t"
          endAdornment={<CalendarIcon className="size-[14px] shrink-0 text-t3" aria-hidden="true" />}
        />
      </label>
      <label>
        <span className="mb-[7px] block text-[12px] font-bold text-t2">계산일수 · 기준</span>
        <input
          aria-label="계산일수 기준"
          readOnly
          value="31"
          className="h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-right text-[13.5px] font-semibold text-t1 outline-none"
        />
      </label>
      <label>
        <span className="mb-[7px] block text-[12px] font-bold text-t2">계산일수 · 부과</span>
        <input
          aria-label="계산일수 부과"
          readOnly
          value={day}
          className="h-[38px] w-full rounded-[10px] border border-[#dee3e8] bg-white px-[11px] text-right text-[13.5px] font-semibold text-t1 outline-none"
        />
      </label>
    </section>
  );
}
