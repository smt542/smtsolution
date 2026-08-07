import React from "react";

export function Select({
  options,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className={`h-11 w-full rounded-xl border border-line bg-bg px-4 text-sm text-t1 focus:border-brand focus:outline-none disabled:opacity-70 ${className}`}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
