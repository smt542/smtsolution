import React from "react";

export type RadioProps = {
  checked: boolean;
  onChange: () => void;
  label: string;
  name: string;
  disabled?: boolean;
  className?: string;
};

export function Radio({
  checked,
  onChange,
  label,
  name,
  disabled = false,
  className = "",
}: RadioProps) {
  return (
    <label
      className={`inline-flex items-center gap-[8px] ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-[19px] w-[19px] shrink-0 rounded-[9.5px] border-2 ${
          checked ? "border-brand" : "border-[#c9d0d8]"
        }`}
      >
        {checked && (
          <span className="absolute left-[3px] top-[3px] h-[9px] w-[9px] rounded-[4.5px] bg-brand" />
        )}
      </span>
      <span className={`text-[13px] font-bold ${checked ? "text-t1" : "text-t3"}`}>
        {label}
      </span>
    </label>
  );
}
