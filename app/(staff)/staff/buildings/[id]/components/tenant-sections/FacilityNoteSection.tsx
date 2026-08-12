"use client";
import React from "react";
export function FacilityNoteSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-2 text-lg font-extrabold text-t1">시설 정보</h2>
      <textarea aria-label="시설 정보" className="min-h-24 w-full rounded-xl border border-line bg-surface p-4 text-sm text-t1 focus:border-brand focus:outline-none"
        value={value} onChange={(e) => onChange(e.target.value)} placeholder="세대 내 시설 현황(자유 기재)" />
    </section>
  );
}
