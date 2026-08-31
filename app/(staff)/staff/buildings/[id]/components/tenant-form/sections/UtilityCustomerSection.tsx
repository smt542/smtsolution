"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, SelectField } from "../ui/Fields";
import type { Opt } from "../ui/options";

export interface UtilityLine {
  customerNo: string;
  meterNo: string;
}
export interface UtilityValue {
  water: UtilityLine;
  elec: UtilityLine;
  elecShared: UtilityLine;
  gas: UtilityLine;
  kepco: UtilityLine;
}
export interface CustomerOptions {
  water: Opt[];
  elec: Opt[];
  commonElec: Opt[];
  gas: Opt[];
}

export function UtilityCustomerSection({
  value,
  onChange,
  customerOptions,
}: {
  value: UtilityValue;
  onChange: (patch: Partial<UtilityValue>) => void;
  customerOptions: CustomerOptions;
}) {
  return (
    <FormSection index={4} title="공과금 고객번호">
      <FieldGrid>
        <Field label="수도 고객번호">
          <SelectField value={value.water.customerNo} onChange={(v) => onChange({ water: { ...value.water, customerNo: v } })} options={customerOptions.water} placeholder="선택" />
        </Field>
        <Field label="수도 계량기 번호">
          <TextField value={value.water.meterNo} onChange={(v) => onChange({ water: { ...value.water, meterNo: v } })} placeholder="계량기 번호" />
        </Field>
        <Field label="전기 고객번호">
          <SelectField value={value.elec.customerNo} onChange={(v) => onChange({ elec: { ...value.elec, customerNo: v } })} options={customerOptions.elec} placeholder="선택" />
        </Field>
        <Field label="전기 계량기 번호">
          <TextField value={value.elec.meterNo} onChange={(v) => onChange({ elec: { ...value.elec, meterNo: v } })} placeholder="계량기 번호" />
        </Field>
        <Field label="공용 전기 고객번호">
          <SelectField value={value.elecShared.customerNo} onChange={(v) => onChange({ elecShared: { ...value.elecShared, customerNo: v } })} options={customerOptions.commonElec} placeholder="선택" />
        </Field>
        <Field label="공용 전기 계량기 번호">
          <TextField value={value.elecShared.meterNo} onChange={(v) => onChange({ elecShared: { ...value.elecShared, meterNo: v } })} placeholder="계량기 번호" />
        </Field>
        <Field label="가스 고객번호">
          <SelectField value={value.gas.customerNo} onChange={(v) => onChange({ gas: { ...value.gas, customerNo: v } })} options={customerOptions.gas} placeholder="선택" />
        </Field>
        <Field label="가스 계량기 번호">
          <TextField value={value.gas.meterNo} onChange={(v) => onChange({ gas: { ...value.gas, meterNo: v } })} placeholder="계량기 번호" />
        </Field>
        <Field label="한전고객번호">
          <TextField value={value.kepco.customerNo} onChange={(v) => onChange({ kepco: { ...value.kepco, customerNo: v } })} placeholder="한전 고객번호" />
        </Field>
        <Field label="한전계기번호">
          <TextField value={value.kepco.meterNo} onChange={(v) => onChange({ kepco: { ...value.kepco, meterNo: v } })} placeholder="한전 계기번호" />
        </Field>
      </FieldGrid>
    </FormSection>
  );
}
