"use client";
import React from "react";
import { Input, Select } from "@/components/common";

export interface BasicInfoValue {
  code: string;
  name: string;
  address: string;
  managerUserId: string | null;
  meterUserId: string | null;
  cleaningUserId: string | null;
}
type Opt = { value: string; label: string };

export function BasicInfoSection({
  value, onChange, staffOptions, errors,
}: {
  value: BasicInfoValue;
  onChange: (patch: Partial<BasicInfoValue>) => void;
  staffOptions: Opt[];
  errors?: Partial<Record<keyof BasicInfoValue, string>>;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">기본 정보</h2>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">건물코드</span>
          <Input aria-label="건물코드" placeholder="미입력 시 자동 생성"
            value={value.code} onChange={(e) => onChange({ code: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">건물명 *</span>
          <Input aria-label="건물명" value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          {errors?.name && <span className="text-xs text-danger">{errors.name}</span>}
        </label>
        <label className="col-span-2 flex flex-col gap-1">
          <span className="text-sm text-t2">주소 *</span>
          <Input aria-label="주소" value={value.address} onChange={(e) => onChange({ address: e.target.value })} />
          {errors?.address && <span className="text-xs text-danger">{errors.address}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">관리담당자</span>
          <Select aria-label="관리담당자" options={staffOptions} value={value.managerUserId ?? ""}
            onChange={(e) => onChange({ managerUserId: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">검침담당자</span>
          <Select aria-label="검침담당자" options={staffOptions} value={value.meterUserId ?? ""}
            onChange={(e) => onChange({ meterUserId: e.target.value || null })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">청소담당자</span>
          <Select aria-label="청소담당자" options={staffOptions} value={value.cleaningUserId ?? ""}
            onChange={(e) => onChange({ cleaningUserId: e.target.value || null })} />
        </label>
      </div>
    </section>
  );
}
