"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, AmountField, SelectField, DateField } from "../ui/Fields";
import { leaseTypeOptions } from "../ui/options";

export interface LeaseValue {
  leaseType: string;
  startDate: string;
  endDate: string;
  deposit: string;
  depositDate: string;
  monthlyRent: string;
  jeonseDeposit: string;
  bankAccount: string;
}

export function LeaseInfoSection({
  value,
  onChange,
}: {
  value: LeaseValue;
  onChange: (patch: Partial<LeaseValue>) => void;
}) {
  return (
    <FormSection index={7} title="임대 정보">
      <FieldGrid>
        <Field label="임대구분">
          <SelectField value={value.leaseType} onChange={(v) => onChange({ leaseType: v })} options={leaseTypeOptions} placeholder="선택" />
        </Field>
        <div className="hidden md:block" aria-hidden />
        <Field label="개시일">
          <DateField value={value.startDate} onChange={(v) => onChange({ startDate: v })} />
        </Field>
        <Field label="만료일">
          <DateField value={value.endDate} onChange={(v) => onChange({ endDate: v })} />
        </Field>
        <Field label="보증금">
          <AmountField value={value.deposit} onChange={(v) => onChange({ deposit: v })} placeholder="예: 0" />
        </Field>
        <Field label="보증금일">
          <DateField value={value.depositDate} onChange={(v) => onChange({ depositDate: v })} />
        </Field>
        <Field label="임대료">
          <AmountField value={value.monthlyRent} onChange={(v) => onChange({ monthlyRent: v })} placeholder="예: 0" />
        </Field>
        <Field label="전세금">
          <AmountField value={value.jeonseDeposit} onChange={(v) => onChange({ jeonseDeposit: v })} placeholder="예: 0" />
        </Field>
        <Field label="은행/계좌">
          <TextField value={value.bankAccount} onChange={(v) => onChange({ bankAccount: v })} placeholder="예: 국민 123456-00-7890" />
        </Field>
      </FieldGrid>
    </FormSection>
  );
}
