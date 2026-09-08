"use client";
import { toast } from "sonner";
import { FieldLabel } from "./FieldLabel";
import { SearchIcon } from "@/components/icons";

/** Figma address block: readonly (grey) search input + 주소 검색 button, then full-width 상세주소 input. */
export function AddressField({
  label,
  required,
  detailPlaceholder = "상세주소 입력 (동·호수 등)",
  value = "",
  detail = "",
  onChange,
  onDetailChange,
}: {
  label: string;
  required?: boolean;
  detailPlaceholder?: string;
  value?: string;
  detail?: string;
  onChange?: (v: string) => void;
  onDetailChange?: (v: string) => void;
}) {
  return (
    <div className="col-span-2 flex flex-col">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex gap-[8px] pt-[6px]">
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="주소 입력 (검색 연동 준비 중)"
          className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-[13px] text-[14px] font-medium text-t1 placeholder:text-t4 focus:border-teal focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            // 카카오/다음 우편번호 연동은 후속 배선. 현재는 수기 입력 대체 안내.
            toast("주소 검색 연동은 준비 중입니다. 직접 입력해 주세요.");
          }}
          className="flex h-[42px] shrink-0 items-center gap-[6px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
        >
          <SearchIcon variant="building-register" className="size-[16px] text-t2" />
          주소 검색
        </button>
      </div>
      <div className="pt-[8px]">
        <input
          value={detail}
          onChange={(e) => onDetailChange?.(e.target.value)}
          placeholder={detailPlaceholder}
          className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[14px] font-medium text-t1 placeholder:text-t4 focus:border-teal focus:outline-none"
        />
      </div>
    </div>
  );
}
