"use client";
import { FormSection } from "../ui/FormSection";
import { TextField } from "../ui/TextField";
import { AddressField } from "../ui/AddressField";
import { TextAreaField } from "../ui/TextAreaField";
import type { RegisterFormState } from "../config/formState";

/** ④ 건물주 정보 (Figma 673:56656). */
export function OwnerInfoSection({
  value,
  patch,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
}) {
  return (
    <FormSection index={4} title="건물주 정보">
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <TextField label="건물주명" placeholder="건물주 이름" value={value.ownerName} onChange={(v) => patch({ ownerName: v })} />
        <TextField label="건물주 전화번호(주)" placeholder="010-0000-0000 / 02-000-0000" inputMode="tel" value={value.ownerPhone} onChange={(v) => patch({ ownerPhone: v })} />
        <TextField label="건물주 전화번호(부)" placeholder="010-0000-0000 / 02-000-0000" inputMode="tel" value={value.ownerPhoneSub} onChange={(v) => patch({ ownerPhoneSub: v })} />
        <AddressField label="건물주 주소" value={value.ownerAddress} detail={value.ownerAddressDetail} onChange={(v) => patch({ ownerAddress: v })} onDetailChange={(v) => patch({ ownerAddressDetail: v })} />
        <TextAreaField label="비고" placeholder="건물주 관련 메모를 입력하세요…" value={value.ownerMemo} onChange={(v) => patch({ ownerMemo: v })} />
      </div>
    </FormSection>
  );
}
