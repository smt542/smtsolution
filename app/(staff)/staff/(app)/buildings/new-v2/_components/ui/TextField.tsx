import { applyMask, Input, type InputMask, NUMERIC_INPUT_ATTRS } from "@/components/common";
import { FieldLabel } from "./FieldLabel";

/** 입력칸 모양 — 읽기 전용은 회색 바탕이고 눌러도 포커스 테두리·그림자를 그리지 않는다(QA S4). */
export function textFieldInputClass(readOnly?: boolean): string {
  return `h-[42px] w-full rounded-[10px] border border-line px-[13px] text-[16px] font-normal leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4 ${
    readOnly ? "bg-bg" : "bg-surface focus:border-teal focus:shadow-[0_0_0_3px_var(--color-teal-t)]"
  }`;
}

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
  maxLength,
  mask,
  error,
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
  maxLength?: number;
  /** 숫자 입력에 구분자를 끼우는 마스크(`components/common/maskedField`의 phoneMask 등). */
  mask?: InputMask;
  /** 입력칸 아래에 붉은 글씨로 보여 줄 문구. 있으면 테두리도 붉게 바뀐다. */
  error?: string;
}) {
  return (
    <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
      <FieldLabel required={required} hint={hint}>
        {label}
      </FieldLabel>
      <div className="pt-[6px]">
        <Input
          unstyled
          {...(mask ? NUMERIC_INPUT_ATTRS : {})}
          value={value ?? ""}
          onChange={(e) =>
            onChange?.(mask ? applyMask(e.currentTarget, mask) : e.target.value)
          }
          readOnly={readOnly}
          placeholder={placeholder}
          // 호출부가 inputMode를 주지 않았을 때 위 스프레드 값이 undefined로 덮이지 않게 한다.
          inputMode={inputMode ?? (mask ? NUMERIC_INPUT_ATTRS.inputMode : undefined)}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          className={`${textFieldInputClass(readOnly)}${error ? " !border-red" : ""}`}
        />
        {error && (
          <p role="alert" className="pt-[6px] text-[12px] font-semibold leading-[normal] text-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
