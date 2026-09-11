"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, SelectField, DateField, TextAreaField } from "../ui/Fields";
import { discountTypeOptions } from "../ui/options";

export interface BasicValue {
  unitNo: string;
  tenantName: string;
  payerName: string;
  roomTypeId: string; // select value; "" = 미선택
  residentCount: string;
  areaPyeong: string; // 평형
  moveInDate: string;
  expectedMoveInDate: string;
  discountType: string;
  discountAmount: string;
  etcNote: string;
  settlementNote: string;
}

export function BasicInfoSection({
  value,
  onChange,
  roomTypeOptions,
  errors,
  moveOutControl,
}: {
  value: BasicValue;
  onChange: (patch: Partial<BasicValue>) => void;
  roomTypeOptions: { value: string; label: string }[];
  errors?: Partial<Record<keyof BasicValue, string>>;
  moveOutControl?: React.ReactNode;
}) {
  const discountMuted = value.discountType === "" || value.discountType === "general";
  return (
    <FormSection index={1} title="기본 정보">
      <FieldGrid>
        <Field label="호실" required error={errors?.unitNo}>
          <TextField value={value.unitNo} onChange={(v) => onChange({ unitNo: v })} placeholder="예: 101" />
        </Field>
        <Field label="입주자명" error={errors?.tenantName}>
          <TextField value={value.tenantName} onChange={(v) => onChange({ tenantName: v })} placeholder="입주자 이름" />
        </Field>
        <Field label="입금자명" error={errors?.payerName}>
          <TextField value={value.payerName} onChange={(v) => onChange({ payerName: v })} placeholder="입금자 이름" />
        </Field>
        <Field label="룸" error={errors?.roomTypeId}>
          <SelectField value={value.roomTypeId} onChange={(v) => onChange({ roomTypeId: v })} options={roomTypeOptions} placeholder="선택" />
        </Field>
        <Field label="인원">
          <TextField value={value.residentCount} onChange={(v) => onChange({ residentCount: v })} placeholder="예: 2" inputMode="numeric" />
        </Field>
        <Field label="평형">
          <TextField value={value.areaPyeong} onChange={(v) => onChange({ areaPyeong: v })} placeholder="예: 18평" inputMode="numeric" />
        </Field>
        <Field label="입주일" error={errors?.moveInDate}>
          <DateField value={value.moveInDate} onChange={(v) => onChange({ moveInDate: v })} />
        </Field>
        <Field label="입주예정일">
          <DateField value={value.expectedMoveInDate} onChange={(v) => onChange({ expectedMoveInDate: v })} />
        </Field>
        <Field label="할인 유형">
          <SelectField value={value.discountType} onChange={(v) => onChange({ discountType: v })} options={discountTypeOptions} />
        </Field>
        <Field label="할인 금액">
          <TextField
            value={discountMuted ? "" : value.discountAmount}
            onChange={(v) => onChange({ discountAmount: v })}
            placeholder="일반은 입력하지 않아요"
            muted={discountMuted}
            inputMode="numeric"
          />
        </Field>
        <Field label="기타적요" full>
          <TextAreaField value={value.etcNote} onChange={(v) => onChange({ etcNote: v })} placeholder="기타 메모를 입력하세요…" />
        </Field>
        <Field label="이사정산시적요" full>
          <TextAreaField value={value.settlementNote} onChange={(v) => onChange({ settlementNote: v })} placeholder="이사정산 관련 메모를 입력하세요…" />
        </Field>
      </FieldGrid>
      {moveOutControl}
    </FormSection>
  );
}
