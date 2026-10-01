"use client";

import { Input } from "./Input";

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-t4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <Input
        unstyled
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-line bg-bg pl-9 pr-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
      />
    </div>
  );
}
