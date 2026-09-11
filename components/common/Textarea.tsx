import React from "react";

export function Textarea({
  className = "",
  error = false,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
}) {
  const border = error
    ? "border-red focus:border-red"
    : "border-line focus:border-brand";
  return (
    <textarea
      className={`w-full rounded-xl border ${border} bg-surface px-4 py-3 text-sm text-t1 placeholder:text-t4 focus:outline-none disabled:opacity-70 ${className}`}
      {...props}
    />
  );
}
