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
  /** 납부자번호(관리비 계좌 payer_no) = 고지서 「코드번호」. 비우면 건물코드 3자리 + 호실 3자리로 저장된다. */
  payerNo: string;
}

export function BillStatementSection({
  value,
  alimtalkOptIn,
  defaultPayerNo,
  onChange,
}: {
  value: BillStatementValue;
  alimtalkOptIn: boolean;
  /** 비워 두면 저장될 자동 코드번호(건물코드 3자리 + 호실 3자리). */
  defaultPayerNo?: string | null;
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
        {/* 「코드번호 출력」이 고지서에 찍는 번호. 지로 납부자번호·입금 매칭·카카오 고지 고객번호(뒤 6자리)에도 쓴다. */}
        <Field label="코드번호(납부자번호)">
          <TextField
            value={value.payerNo}
            onChange={(v) => onChange({ payerNo: v.replace(/\D/g, "") })}
            placeholder={defaultPayerNo ? `비우면 ${defaultPayerNo}` : "건물코드+호실 자동"}
            inputMode="numeric"
          />
        </Field>
        <Field label="발송">
          <div className="pointer-events-none opacity-60">
            <SelectField value={value.billDelivery} onChange={(v) => onChange({ billDelivery: v })} options={billDeliveryOptions} disabled />
          </div>
          <p className="mt-[6px] text-[12px] font-semibold leading-[1.5] text-t3">
            {alimtalkOptIn
              ? "알림톡 수신 동의 세대는 알림톡 고지서로 발송돼요"
              : "알림톡 수신 거부 세대는 우편으로 발송돼요"}
          </p>
        </Field>
        <Field label="인증">
          <TextField value={value.billAuthInfo} onChange={(v) => onChange({ billAuthInfo: v })} placeholder="인증 정보" />
        </Field>
      </FieldGrid>
    </FormSection>
  );
}
