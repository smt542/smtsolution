import { FieldLabel } from "./FieldLabel";

/** Figma text input: h-42 rounded-10 border-line, 14px value, t4 placeholder. readOnly → grey bg (#F2F4F6). */
export function TextField({
  label,
  required,
  hint,
  placeholder,
  value,
  onChange,
  readOnly,
  full,
  inputMode,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  full?: boolean;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <div className="pt-[6px]">
        <input
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          inputMode={inputMode}
          className={`h-[42px] w-full rounded-[10px] border border-line px-[13px] text-[14px] font-medium text-t1 placeholder:text-t4 focus:border-teal focus:outline-none ${
            readOnly ? "bg-bg" : "bg-surface"
          }`}
        />
      </div>
    </div>
  );
}
