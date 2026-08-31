"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, SelectField, TextAreaField } from "../ui/Fields";
import { ynOptions, transferMethodOptions } from "../ui/options";

export interface BillingValue {
  mgmtFeeAmount: string;
  moveCleaningFee: string;
  increaseAmount: string;
  billingEnabled: boolean;
  billingDay: string;
  transferMethod: string;
  lateFeeEnabled: boolean;
  singlePrint: boolean;
  billingNote: string;
}

export function BillingSection({
  value,
  onChange,
}: {
  value: BillingValue;
  onChange: (patch: Partial<BillingValue>) => void;
}) {
  return (
    <FormSection index={3} title="관리비·부과">
      <FieldGrid>
        <Field label="관리비">
          <TextField type="number" value={value.mgmtFeeAmount} onChange={(v) => onChange({ mgmtFeeAmount: v })} placeholder="예: 120,000" min={0} />
        </Field>
        <Field label="이사청소">
          <TextField type="number" value={value.moveCleaningFee} onChange={(v) => onChange({ moveCleaningFee: v })} placeholder="예: 70,000" min={0} />
        </Field>
        <Field label="인상액">
          <TextField type="number" value={value.increaseAmount} onChange={(v) => onChange({ increaseAmount: v })} placeholder="예: 0" min={0} />
        </Field>
        <Field label="부과금 여부">
          <SelectField value={value.billingEnabled ? "Y" : "N"} onChange={(v) => onChange({ billingEnabled: v === "Y" })} options={ynOptions} />
        </Field>
        <Field label="부과일">
          <TextField value={value.billingDay} onChange={(v) => onChange({ billingDay: v })} placeholder="예: 매월 1일" />
        </Field>
        <Field label="이체 방식">
          <SelectField value={value.transferMethod} onChange={(v) => onChange({ transferMethod: v })} options={transferMethodOptions} />
        </Field>
        <Field label="연체료 부과 여부">
          <SelectField value={value.lateFeeEnabled ? "Y" : "N"} onChange={(v) => onChange({ lateFeeEnabled: v === "Y" })} options={ynOptions} />
        </Field>
        <Field label="단수 출력 여부">
          <SelectField value={value.singlePrint ? "Y" : "N"} onChange={(v) => onChange({ singlePrint: v === "Y" })} options={ynOptions} />
        </Field>
        <Field label="부과시 참조사항" full>
          <TextAreaField value={value.billingNote} onChange={(v) => onChange({ billingNote: v })} placeholder="관리비 부과 시 참고할 내용을 입력하세요…" />
        </Field>
      </FieldGrid>
    </FormSection>
  );
}
