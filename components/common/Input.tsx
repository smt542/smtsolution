import React from "react";

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none disabled:opacity-70 ${className}`}
      {...props}
    />
  );
}
