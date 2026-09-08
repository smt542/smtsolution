"use client";
import React from "react";

const MAX = 1000;

export function MemoSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-t1">참고사항</h2>
        <span className="text-xs text-t4">{value.length} / {MAX}</span>
      </div>
      <textarea
        aria-label="참고사항"
        className="min-h-32 w-full rounded-xl border border-line bg-surface p-4 text-sm text-t1 focus:border-brand focus:outline-none"
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value.slice(0, MAX))}
      />
    </section>
  );
}
