"use client";
import React, { useRef } from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, AmountField, SelectField, DateField } from "../ui/Fields";
import { FacilityField } from "../ui/FacilityField";
import { propertyTypeOptions, dealTypeOptions, propertyClassOptions } from "../ui/options";
import type { Facility } from "@/hooks/reactquery/occupancies";

export interface PropertyValue {
  propertyName: string;
  address: string;
  addressDetail: string;
  propertyType: string;
  dealType: string;
  rentType: string;
  areaM2: string;
  deposit: string;
  jeonseDeposit: string;
  monthlyRent: string;
  mgmtFeeDesc: string;
  availableDate: string;
  location: string;
  facilities: Facility[];
}

export function PropertyInfoSection({
  value,
  onChange,
}: {
  value: PropertyValue;
  onChange: (patch: Partial<PropertyValue>) => void;
}) {
  const addressRef = useRef<HTMLInputElement>(null);
  return (
    <FormSection index={8} title="부동산 정보">
      <div>
        <p className="mb-[11px] text-[13.5px] font-extrabold text-t1">매물 정보</p>
        <FieldGrid>
          <Field label="물건명">
            <TextField value={value.propertyName} onChange={(v) => onChange({ propertyName: v })} placeholder="물건 이름" />
          </Field>
          <Field label="물건 주소" full>
            <div className="flex items-center gap-[8px]">
              <TextField ref={addressRef} value={value.address} onChange={(v) => onChange({ address: v })} placeholder="주소 검색으로 입력" />
              <button
                type="button"
                onClick={() => addressRef.current?.focus()}
                className="flex h-[42px] shrink-0 items-center gap-[6px] rounded-[11px] border border-line bg-white px-[15px] text-[13.5px] font-bold text-t2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" />
                </svg>
                주소 검색
              </button>
            </div>
            <div className="pt-[8px]">
              <TextField value={value.addressDetail} onChange={(v) => onChange({ addressDetail: v })} placeholder="상세주소 입력 (동·호수 등)" />
            </div>
          </Field>
          <Field label="물건구분">
            <SelectField value={value.propertyType} onChange={(v) => onChange({ propertyType: v })} options={propertyTypeOptions} placeholder="선택" />
          </Field>
          <Field label="거래형태">
            <SelectField value={value.dealType} onChange={(v) => onChange({ dealType: v })} options={dealTypeOptions} placeholder="선택" />
          </Field>
          <Field label="구분">
            <SelectField value={value.rentType} onChange={(v) => onChange({ rentType: v })} options={propertyClassOptions} placeholder="선택" />
          </Field>
          <Field label="면적(㎡)">
            <TextField value={value.areaM2} onChange={(v) => onChange({ areaM2: v })} placeholder="예: 42.5" inputMode="decimal" />
          </Field>
          <Field label="보증금">
            <AmountField value={value.deposit} onChange={(v) => onChange({ deposit: v })} placeholder="예: 0" />
          </Field>
          <Field label="전세금">
            <AmountField value={value.jeonseDeposit} onChange={(v) => onChange({ jeonseDeposit: v })} placeholder="예: 0" />
          </Field>
          <Field label="월세">
            <AmountField value={value.monthlyRent} onChange={(v) => onChange({ monthlyRent: v })} placeholder="예: 0" />
          </Field>
          <Field label="관리비 내용">
            <TextField value={value.mgmtFeeDesc} onChange={(v) => onChange({ mgmtFeeDesc: v })} placeholder="예: 월 5만원 (수도 포함)" />
          </Field>
          <Field label="입주가능일">
            <DateField value={value.availableDate} onChange={(v) => onChange({ availableDate: v })} />
          </Field>
          <Field label="위치" full>
            <TextField value={value.location} onChange={(v) => onChange({ location: v })} placeholder="위치 입력" />
          </Field>
        </FieldGrid>
      </div>
      <div className="mt-[22px] border-t border-line pt-[20px]">
        <p className="mb-[11px] text-[13.5px] font-extrabold text-t1">시설정보</p>
        <FacilityField value={value.facilities} onChange={(v) => onChange({ facilities: v })} />
      </div>
    </FormSection>
  );
}
