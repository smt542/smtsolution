"use client";
import { phoneMask } from "@/components/common";
import React from "react";
import { FormSection } from "../ui/FormSection";
import { FieldGrid, Field, TextField, SelectField } from "../ui/Fields";
import { RepeatableTextField } from "../ui/RepeatableTextField";
import { agreeOptions } from "../ui/options";

export interface ContactValue {
  phones: string[];
  vehicles: string[];
  smsOptIn: boolean;
  alimtalkOptIn: boolean;
  homepagePassword: string;
}

export function ContactSection({
  value,
  onChange,
  errors,
}: {
  value: ContactValue;
  onChange: (patch: Partial<ContactValue>) => void;
  errors?: { phones?: string };
}) {
  return (
    <FormSection index={2} title="연락처·차량">
      <div className="flex flex-col gap-[16px]">
        <Field label="전화번호" required full error={errors?.phones}>
          <RepeatableTextField
            values={value.phones}
            onChange={(v) => onChange({ phones: v })}
            placeholders={["010-0000-0000", "010-0000-0000"]}
            addLabel="전화번호 추가"
            mask={phoneMask}
          />
        </Field>
        <Field label="차량번호" full>
          <RepeatableTextField
            values={value.vehicles}
            onChange={(v) => onChange({ vehicles: v })}
            placeholders={["예: 12가 3456"]}
            addLabel="차량번호 추가"
          />
        </Field>
        <FieldGrid>
          <Field label="문자 수신">
            <SelectField
              value={value.smsOptIn ? "agree" : "deny"}
              onChange={(v) => onChange({ smsOptIn: v === "agree" })}
              options={agreeOptions}
            />
          </Field>
          <Field label="알림톡 수신">
            <SelectField
              value={value.alimtalkOptIn ? "agree" : "deny"}
              onChange={(v) => onChange({ alimtalkOptIn: v === "agree" })}
              options={agreeOptions}
            />
          </Field>
          <Field label="홈피 비번">
            <TextField value={value.homepagePassword} onChange={(v) => onChange({ homepagePassword: v })} placeholder="홈페이지 비밀번호" />
          </Field>
        </FieldGrid>
      </div>
    </FormSection>
  );
}
