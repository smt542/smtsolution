"use client";

import { Input } from "@/components/common";
import { useAddressSearchPopup } from "@/hooks/common/useAddressSearchPopup";
import { FieldLabel } from "./FieldLabel";
import { SearchIcon } from "@/components/icons";

/** 주소 블록: 카카오 우편번호 서비스로 고른 주소(읽기 전용) + 상세주소 입력. */
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
  const openAddressSearch = useAddressSearchPopup((address) => onChange?.(address));

  return (
    <div className="col-span-2 flex flex-col">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex gap-[8px] pt-[6px]">
        <Input
          unstyled
          value={value}
          readOnly
          placeholder="주소 검색으로 입력"
          className="h-[42px] min-w-0 flex-1 cursor-not-allowed rounded-[10px] border border-line bg-bg px-[13px] text-[16px] font-normal leading-[normal] text-t3 outline-none placeholder:font-medium placeholder:text-t4"
        />
        <button
          type="button"
          onClick={openAddressSearch}
          className="flex h-[42px] shrink-0 items-center gap-[6px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
        >
          <SearchIcon variant="building-register" className="size-[16px] text-t2" />
          주소 검색
        </button>
      </div>
      <div className="pt-[8px]">
        <Input
          unstyled
          value={detail}
          onChange={(event) => onDetailChange?.(event.target.value)}
          placeholder={detailPlaceholder}
          className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[16px] font-normal leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4 focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)]"
        />
      </div>
    </div>
  );
}
