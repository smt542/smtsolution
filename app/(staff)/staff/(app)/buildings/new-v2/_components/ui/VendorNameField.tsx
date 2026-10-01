"use client";
import { useRef } from "react";
import { Input } from "@/components/common";
import { SelectField } from "./SelectField";
import { textFieldInputClass } from "./TextField";

/** 정본 업체 드롭다운의 마지막 항목. */
export const VENDOR_MANUAL_OPTION = "직접입력";

/** 정본 building-detail 업체명 칸: 같은 구분의 협력업체 + 직접입력 드롭다운, 직접입력이면 아래에 업체명 입력칸. */
export function VendorNameField({
  label,
  placeholder,
  vendors,
  selectedValue,
  manual,
  name,
  onPick,
  onManual,
  onNameChange,
}: {
  label: string;
  placeholder?: string;
  /** 같은 구분의 협력업체(값 = 업체 키, 글자 = 업체명 — 이름이 같은 업체도 따로 보인다). */
  vendors: { value: string; label: string }[];
  /** 지금 고른 업체의 값. 목록과 맞는 업체가 없으면 업체명을 그대로 보인다. */
  selectedValue: string | null;
  manual: boolean;
  name: string;
  onPick: (value: string) => void;
  onManual: () => void;
  onNameChange: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col">
      <SelectField
        label={label}
        placeholder={placeholder}
        options={[...vendors, VENDOR_MANUAL_OPTION]}
        value={manual ? VENDOR_MANUAL_OPTION : selectedValue ?? name}
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
        <Input
          unstyled
          ref={inputRef}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="업체명 직접입력"
          aria-label={`${label} 직접입력`}
          className={`mt-[6px] ${textFieldInputClass()}`}
        />
      )}
    </div>
  );
}
