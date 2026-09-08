import { FieldLabel } from "./FieldLabel";
import { CalendarIcon } from "@/components/icons";

/** Figma date box: same shell as text input with a trailing 16px calendar icon. Placeholder YYYY.MM.DD. */
export function DateField({
  label,
  required,
  placeholder = "YYYY.MM.DD",
  value,
  onChange,
  full,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="pt-[6px]">
        <div className="flex h-[42px] w-full items-center justify-between rounded-[10px] border border-line bg-surface px-[13px] focus-within:border-teal">
          <input
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            inputMode="numeric"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-t1 placeholder:text-t4 focus:outline-none"
          />
          <CalendarIcon variant="building-register" className="size-[16px] shrink-0 text-t3" />
        </div>
      </div>
    </div>
  );
}
