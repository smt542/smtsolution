"use client";
import { useRef } from "react";
import { SelectField } from "./SelectField";
import { textFieldInputClass } from "./TextField";

/** 정본 업체 드롭다운의 마지막 항목. */
export const VENDOR_MANUAL_OPTION = "직접입력";

/** 정본 building-detail 업체명 칸: 같은 구분의 협력업체 + 직접입력 드롭다운, 직접입력이면 아래에 업체명 입력칸. */
export function VendorNameField({
  label,
  placeholder,
  names,
  manual,
  value,
  onPick,
  onManual,
  onNameChange,
}: {
  label: string;
  placeholder?: string;
  /** 드롭다운에 보일 업체명(같은 구분). */
  names: string[];
  manual: boolean;
  value: string;
  onPick: (name: string) => void;
  onManual: () => void;
  onNameChange: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col">
      <SelectField
        label={label}
        placeholder={placeholder}
        options={[...names, VENDOR_MANUAL_OPTION]}
        value={manual ? VENDOR_MANUAL_OPTION : value}
        onChange={(option) => {
          if (option !== VENDOR_MANUAL_OPTION) {
            onPick(option);
            return;
          }
          onManual();
          // 정본처럼 직접입력을 고르면 바로 업체명 입력칸에 커서를 둔다.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      />
      {manual && (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="업체명 직접입력"
          aria-label={`${label} 직접입력`}
          className={`mt-[6px] ${textFieldInputClass()}`}
        />
      )}
    </div>
  );
}
