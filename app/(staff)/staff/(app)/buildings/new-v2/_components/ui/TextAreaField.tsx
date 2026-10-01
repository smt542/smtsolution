import { Textarea } from "@/components/common";
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
  minHeight = 76,
  full = true,
  maxLength,
  lineHeight = 1.5,
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
  maxLength?: number;
  lineHeight?: number;
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      {label && (
        <FieldLabel required={required} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className={label ? "pt-[6px]" : ""}>
        <Textarea
          unstyled
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          style={{ minHeight, lineHeight }}
          className="block w-full resize-y rounded-[10px] border border-line bg-surface px-[13px] py-[11px] text-[16px] font-normal text-t1 outline-none placeholder:font-medium placeholder:text-t4 focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)]"
        />
      </div>
      {footer && <p className="pt-[6px] text-[12px] font-semibold leading-[normal] text-t4">{footer}</p>}
    </div>
  );
}
