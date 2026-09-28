import React from "react";

/**
 * 공통 textarea.
 *
 * `variant`는 기하(테두리 반경·패딩·타이포)만 정하고, `showCount`는 문자수 카운터만 붙인다.
 * 둘은 독립이다 — 카운터를 쓴다고 Figma 규격이 강제되지 않는다.
 * `compact` 규격은 `docs/superpowers/plans/2026-09-18-setup-figma-tokens.md` 실측값.
 */
const VARIANTS = {
  default: "rounded-xl px-4 py-3 text-sm",
  compact:
    "rounded-[12px] px-[13px] py-[12px] text-[14px] font-medium leading-[22.4px] placeholder:text-[14px] placeholder:font-medium placeholder:leading-[22.4px]",
  // 정본 `.as-in.as-ta`: 86px/10px/9·11px/13px, 세로 리사이즈·3px 청록 링.
  form: "min-h-[86px] resize-y rounded-[10px] px-[11px] py-[9px] text-[13px] leading-[1.6] placeholder:font-medium focus:ring-[3px] focus:ring-teal-t",
} as const;

export function Textarea({
  className = "",
  error = false,
  variant = "default",
  showCount = false,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
  variant?: keyof typeof VARIANTS;
  showCount?: boolean;
}) {
  const border = error ? "border-red focus:border-red" : "border-line focus:border-brand";
  const field = (
    <textarea
      className={`w-full border ${border} ${VARIANTS[variant]} bg-surface text-t1 placeholder:text-t4 focus:outline-none disabled:opacity-70 ${className}`}
      {...props}
    />
  );

  // 카운터는 현재 길이를 알아야 하므로 controlled(`value`)일 때만 붙인다.
  if (!showCount || props.maxLength === undefined || props.value === undefined) return field;

  return (
    <div className="flex w-full flex-col gap-[10px]">
      {field}
      <p className="text-right text-[12px] font-semibold text-t4">
        {String(props.value).length} / {props.maxLength}자
      </p>
    </div>
  );
}
