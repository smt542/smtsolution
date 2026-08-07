import React from "react";

export function Checkbox({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer ${className}`}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line accent-brand disabled:opacity-70"
        {...props}
      />
      <span className="text-sm text-t2">{label}</span>
    </label>
  );
}
