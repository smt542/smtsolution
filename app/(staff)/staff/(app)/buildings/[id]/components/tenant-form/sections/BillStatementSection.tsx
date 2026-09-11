"use client";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, SelectField } from "../ui/Fields";
import { ynOptions, billNameDisplayOptions, billDeliveryOptions } from "../ui/options";

export interface BillStatementValue {
  printEnabled: boolean;
  billNameDisplay: string;
  billDelivery: string;
  billAuthInfo: string;
}

export function BillStatementSection({
  value,
  onChange,
}: {
  value: BillStatementValue;
  onChange: (patch: Partial<BillStatementValue>) => void;
}) {
  return (
    <FormSection index={5} title="고지서">
      <FieldGrid>
        <Field label="고지서 출력 여부">
          <SelectField value={value.printEnabled ? "Y" : "N"} onChange={(v) => onChange({ printEnabled: v === "Y" })} options={ynOptions} />
        </Field>
        <Field label="고지서 이름 출력 유형">
          <SelectField value={value.billNameDisplay} onChange={(v) => onChange({ billNameDisplay: v })} options={billNameDisplayOptions} />
        </Field>
        <Field label="발송">
          <SelectField value={value.billDelivery} onChange={(v) => onChange({ billDelivery: v })} options={billDeliveryOptions} />
          {value.billDelivery === "alimtalk" && (
            <p className="pt-[6px] text-[12px] font-semibold leading-[1.5] text-teal">
              알림톡 수신 동의 세대는 이체 방식과 무관하게 알림톡 고지서로 발송돼요
            </p>
          )}
        </Field>
        <Field label="인증">
          <TextField value={value.billAuthInfo} onChange={(v) => onChange({ billAuthInfo: v })} placeholder="인증 정보" />
        </Field>
      </FieldGrid>
    </FormSection>
  );
}
