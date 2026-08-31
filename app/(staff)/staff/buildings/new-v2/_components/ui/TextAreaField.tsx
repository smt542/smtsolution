import { FieldLabel } from "./FieldLabel";

/** Figma textarea: rounded-10 border-line, px-13 py-11, 14px value, optional helper/counter footer. */
export function TextAreaField({
  label,
  required,
  hint,
  placeholder,
  value,
  onChange,
  footer,
  minHeight = 84,
  full = true,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  footer?: string;
  minHeight?: number;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      {label && (
        <FieldLabel required={required} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className={label ? "pt-[6px]" : ""}>
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full resize-y rounded-[10px] border border-line bg-surface px-[13px] py-[11px] text-[14px] font-medium leading-[22px] text-t1 placeholder:text-t4 focus:border-teal focus:outline-none"
        />
      </div>
      {footer && <p className="pt-[6px] text-[12px] font-semibold text-t4">{footer}</p>}
    </div>
  );
}
