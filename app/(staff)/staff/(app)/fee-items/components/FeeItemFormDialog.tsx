"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DEFAULT_FORM_VALUE, ROUNDING_OPTIONS } from "./constants";
import type { FeeItemDraft, FeeItemFormValue, RoundingRule } from "./types";
import { CustomDropdown } from "@/components/common/CustomDropdown";

interface FeeItemFormDialogProps {
  open: boolean;
  item: FeeItemDraft | null;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (value: FeeItemFormValue) => void;
  onDelete: () => void;
}

const booleanOptions = [
  { value: "true", label: "적용" },
  { value: "false", label: "안함" },
];

export function FeeItemFormDialog({
  open,
  item,
  existingNames,
  onClose,
  onSubmit,
  onDelete,
}: FeeItemFormDialogProps) {
  const [value, setValue] = useState<FeeItemFormValue>(() => item
    ? {
        name: item.name,
        rounding: item.rounding,
        dailyProration: item.dailyProration,
        carryOver: item.carryOver,
      }
    : DEFAULT_FORM_VALUE);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = value.name.trim();
    if (!name) {
      setError("항목 명칭을 입력해 주세요.");
      return;
    }
    if (existingNames.some((candidate) => candidate.trim() === name)) {
      setError("이미 등록된 항목 명칭입니다.");
      return;
    }
    onSubmit({ ...value, name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171f28]/50 px-4" onMouseDown={onClose}>
      <form
        aria-label={item ? "관리 항목 수정" : "관리 항목 추가"}
        className="w-full max-w-[420px] -translate-y-[5px] overflow-hidden rounded-[20px] bg-white shadow-pop"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-[68px] items-center justify-between border-b border-line px-[22px]">
          <h2 className="text-[17px] font-extrabold text-t1">관리 항목 {item ? "수정" : "추가"}</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>
            <Image src="/icons/fee-items/close.svg" alt="" width={20} height={20} />
          </button>
        </header>

        <div className="space-y-[13px] px-[22px] pb-[37px] pt-5">
          <label className="block text-xs font-bold text-t2">
            항목 명칭
            <input
              autoFocus
              value={value.name}
              maxLength={30}
              placeholder="예: 일반관리비"
              className="mt-1.5 h-11 w-full rounded-[11px] border border-line px-3 text-[13px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-teal focus:ring-2 focus:ring-teal-t"
              onChange={(event) => {
                setValue((current) => ({ ...current, name: event.target.value }));
                setError("");
              }}
            />
            {error && <span role="alert" className="mt-1.5 block text-[11px] text-red">{error}</span>}
          </label>

          <SelectField
            label="반올림"
            value={value.rounding}
            options={ROUNDING_OPTIONS}
            onChange={(rounding) => setValue((current) => ({ ...current, rounding: rounding as RoundingRule }))}
          />
          <SelectField
            label="일자계산"
            value={String(value.dailyProration)}
            options={booleanOptions}
            onChange={(dailyProration) =>
              setValue((current) => ({ ...current, dailyProration: dailyProration === "true" }))
            }
          />
          <SelectField
            label="이월"
            value={String(value.carryOver)}
            options={[
              { value: "true", label: "이월" },
              { value: "false", label: "안함" },
            ]}
            onChange={(carryOver) =>
              setValue((current) => ({ ...current, carryOver: carryOver === "true" }))
            }
          />
        </div>

        <footer className="flex h-[69px] items-center gap-[9px] border-t border-line px-[22px]">
          {item ? (
            <>
              {!item.isRequired && (
                <button type="button" className="h-10 rounded-[11px] bg-red-t px-5 text-[13.5px] font-bold text-red hover:bg-[#fbdbe0]" onClick={onDelete}>삭제</button>
              )}
              <button type="submit" className="h-10 flex-1 rounded-[11px] bg-teal text-[13.5px] font-bold text-white hover:bg-teal-d">수정</button>
            </>
          ) : (
            <button type="submit" className="h-10 w-full rounded-[11px] bg-teal text-[13.5px] font-bold text-white hover:bg-teal-d">추가</button>
          )}
        </footer>
      </form>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="text-xs font-bold text-t2">
      <span className="flex items-center gap-1.5">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-t3 text-[9px] font-bold text-t3">i</span>
        {label}
      </span>
      <div className="mt-1.5 [&_.uc-dd]:w-full [&_.uc-dd-btn]:h-11 [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:text-[13px]">
        <CustomDropdown ariaLabel={label} value={value} options={options} onChange={onChange} />
      </div>
    </div>
  );
}
