"use client";
import React from "react";
import { Checkbox, Input } from "@/components/common";
import { FACILITY_KEYS, type FacilitiesMap, type FacilityKey } from "@/hooks/reactquery/buildings";

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  cctv: "CCTV", elevator: "승강기", cleaning: "청소담당", metering: "검침담당", management: "관리담당",
  septic: "정화조", internet: "인터넷", electric_safety: "전기안전관리", fire_safety: "소방안전관리",
};

export function FacilitiesSection({
  value, onChange,
}: {
  value: FacilitiesMap;
  onChange: (next: FacilitiesMap) => void;
}) {
  const set = (k: FacilityKey, patch: Partial<{ on: boolean; memo: string }>) =>
    onChange({ ...value, [k]: { ...value[k], ...patch } });

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">시설 정보</h2>
      <div className="grid grid-cols-1 gap-3">
        {FACILITY_KEYS.map((k) => (
          <div key={k} className="flex items-center gap-4">
            <div className="w-40">
              <Checkbox label={FACILITY_LABELS[k]} checked={value[k].on} onChange={(e) => set(k, { on: e.target.checked })} />
            </div>
            <Input
              aria-label={`${FACILITY_LABELS[k]} 메모`}
              disabled={!value[k].on}
              value={value[k].memo}
              onChange={(e) => set(k, { memo: e.target.value })}
              placeholder="메모(선택)"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
