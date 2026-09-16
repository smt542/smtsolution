"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FieldLabel } from "./FieldLabel";
import { SearchIcon } from "@/components/icons";

const SAMPLE_ADDRESSES = [
  { road: "서울 강서구 화곡로 12", lot: "서울 강서구 화곡동 123-45" },
  { road: "서울 강서구 화곡로 30", lot: "서울 강서구 화곡동 200-1" },
  { road: "서울 관악구 봉천로 88", lot: "서울 관악구 봉천동 55-3" },
  { road: "경기 부천시 원미구 부일로 210", lot: "경기 부천시 심곡동 77" },
];

function AddressSearchDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (address: string) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLowerCase();
  const addresses = SAMPLE_ADDRESSES.filter(
    ({ road, lot }) => !normalized || road.toLowerCase().includes(normalized) || lot.toLowerCase().includes(normalized),
  );

  useEffect(() => {
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-scrim"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-search-title"
        className="w-[min(460px,92%)] rounded-[20px] bg-surface p-[24px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="address-search-title" className="mb-[3px] text-[17px] font-extrabold leading-[normal] text-t1">
          주소 검색
        </h2>
        <p className="mb-[13px] text-[12.5px] font-semibold leading-[normal] text-t3">
          카카오 주소 API · 도로명·건물명·지번 검색
        </p>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예) 화곡로 12, 그린빌라"
          className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[16px] font-normal leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4 focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)]"
        />
        <div className="mt-[12px] max-h-[280px] overflow-auto">
          {addresses.map(({ road, lot }) => (
            <button
              key={road}
              type="button"
              onClick={() => onSelect(road)}
              className="mb-[7px] block w-full rounded-[10px] border border-line px-[13px] py-[12px] text-left hover:border-teal hover:bg-blue-t2"
            >
              <span className="block text-[13.5px] font-bold leading-[normal] text-t1">{road}</span>
              <span className="mt-[2px] block text-[12px] leading-[normal] text-t3">지번 {lot}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Prototype address block: readonly search result + address picker, followed by a detail input. */
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
  const [open, setOpen] = useState(false);

  return (
    <div className="col-span-2 flex flex-col">
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex gap-[8px] pt-[6px]">
        <input
          value={value}
          readOnly
          placeholder="주소 검색으로 입력"
          className="h-[42px] min-w-0 flex-1 cursor-not-allowed rounded-[10px] border border-line bg-bg px-[13px] text-[16px] font-normal leading-[normal] text-t3 outline-none placeholder:font-medium placeholder:text-t4"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[42px] shrink-0 items-center gap-[6px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
        >
          <SearchIcon variant="building-register" className="size-[16px] text-t2" />
          주소 검색
        </button>
      </div>
      <div className="pt-[8px]">
        <input
          value={detail}
          onChange={(event) => onDetailChange?.(event.target.value)}
          placeholder={detailPlaceholder}
          className="h-[42px] w-full rounded-[10px] border border-line bg-surface px-[13px] text-[16px] font-normal leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4 focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)]"
        />
      </div>
      {open && (
        <AddressSearchDialog
          onClose={() => setOpen(false)}
          onSelect={(address) => {
            onChange?.(address);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
