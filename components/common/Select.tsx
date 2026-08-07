import React from "react";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string }[];
  }
>(function Select({ options, className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
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
});
