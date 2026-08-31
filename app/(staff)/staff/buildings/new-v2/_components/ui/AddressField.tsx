"use client";
import { useState } from "react";
import { toast } from "sonner";
import { FieldLabel } from "./FieldLabel";
import { SearchIcon } from "@/components/icons";

/** Figma address block: readonly (grey) search input + 주소 검색 button, then full-width 상세주소 input. */
export function AddressField({
  label,
  required,
  detailPlaceholder = "상세주소 입력 (동·호수 등)",
}: {
  label: string;
  required?: boolean;
  detailPlaceholder?: string;
}) {
  const [addr, setAddr] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div className="col-span-2 flex flex-col">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex gap-[8px] pt-[6px]">
        <input
          readOnly
          value={addr}
          placeholder="주소 검색으로 입력"
          className="h-[42px] min-w-0 flex-1 rounded-[10px] border border-line bg-bg px-[13px] text-[14px] font-medium text-t1 placeholder:text-t4 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            // 미리보기: 카카오/다음 우편번호 연동은 실제 화면에서 배선
            setAddr("서울특별시 ○○구 ○○로 123");
            toast("주소 검색은 미리보기입니다");
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
          onChange={(e) => setDetail(e.target.value)}
          placeholder={detailPlaceholder}
          className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[14px] font-medium text-t1 placeholder:text-t4 focus:border-teal focus:outline-none"
        />
      </div>
    </div>
  );
}
