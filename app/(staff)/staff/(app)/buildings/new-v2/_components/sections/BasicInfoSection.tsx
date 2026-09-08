"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { DateField } from "../ui/DateField";
import { AddressField } from "../ui/AddressField";
import { TextAreaField } from "../ui/TextAreaField";
import type { RegisterFormState } from "../config/formState";

const GROUP_TYPES = ["1", "2", "3", "4", "5"];
const WATER_COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "10"];

/** ① 기본 정보 (Figma 673:55665). */
export function BasicInfoSection({
  value,
  patch,
  buildingTypeOptions,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
  buildingTypeOptions: string[];
}) {
  return (
    <CollapsibleFormSection index={1} title="기본 정보">
      <FormGrid>
        <TextField label="건물 코드" placeholder="비우면 자동 생성" inputMode="numeric" value={value.code} onChange={(v) => patch({ code: v })} />
        <TextField label="건물명" required placeholder="건물명 입력" value={value.name} onChange={(v) => patch({ name: v })} />
        <SelectField label="건물 유형" placeholder={buildingTypeOptions.length ? "선택" : "설정에서 유형 등록"} options={buildingTypeOptions} value={value.buildingType} onChange={(v) => patch({ buildingType: v })} />
        <TextField label="공동현관" placeholder="공동현관 비밀번호" value={value.gate} onChange={(v) => patch({ gate: v })} />
        <AddressField label="주소" required value={value.address} detail={value.addressDetail} onChange={(v) => patch({ address: v })} onDetailChange={(v) => patch({ addressDetail: v })} />
        <SelectField label="고지서 부과 그룹 유형" options={GROUP_TYPES} value={value.groupType} onChange={(v) => patch({ groupType: v })} />
        <SelectField label="수도 고객번호 보유" options={WATER_COUNTS} value={value.waterCount} onChange={(v) => patch({ waterCount: v })} />
        <DateField label="계약일" value={value.contractDate} onChange={(v) => patch({ contractDate: v })} />
        <DateField label="해지일" value={value.terminationDate} onChange={(v) => patch({ terminationDate: v })} />
        <TextAreaField
          label="건물 상시 공지문"
          hint=" · 세입자 앱 홈의 건물 공지에 표시돼요"
          placeholder="예: 매주 화요일 오전 9시부터 11시까지 저수조 청소가 진행됩니다."
          footer="비워 두면 세입자 홈에 건물 공지가 표시되지 않아요"
          value={value.standingNotice}
          onChange={(v) => patch({ standingNotice: v })}
        />
      </FormGrid>
    </CollapsibleFormSection>
  );
}
