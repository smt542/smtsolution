import React from "react";

/**
 * @deprecated 네이티브 select를 그린다 — 정본 QA 공통 규칙(드롭다운은 커스텀)에 어긋나므로 CustomDropdown을 쓴다.
 * 남은 import는 어디서도 불리지 않는 옛 파일뿐이다.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
  }
>(function Select({ options, className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none disabled:opacity-70 ${className}`}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});
