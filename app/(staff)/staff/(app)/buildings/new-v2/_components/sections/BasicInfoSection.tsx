"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { DateField } from "../ui/DateField";
import { AddressField } from "../ui/AddressField";
import { TextAreaField } from "../ui/TextAreaField";
import { BUILDING_GROUP_TYPES } from "@/lib/buildings/groupType";
import type { RegisterFormState } from "../config/formState";

const GROUP_TYPES = [...BUILDING_GROUP_TYPES];
const WATER_COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "10"];
const PROTOTYPE_BUILDING_TYPES = ["빌라", "빌딩"];

/** ① 기본 정보 (Figma 673:55665). */
export function BasicInfoSection({
  value,
  patch,
  buildingTypeOptions,
  codeError,
  terminationError,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
  buildingTypeOptions: string[];
  /** 건물 코드 입력칸 아래에 보여 줄 오류(중복 등). */
  codeError?: string;
  /** 해지일 입력칸 아래에 보여 줄 오류(계약일보다 빠름). */
  terminationError?: string;
}) {
  const typeOptions = Array.from(new Set([...PROTOTYPE_BUILDING_TYPES, ...buildingTypeOptions]));

  return (
    <CollapsibleFormSection index={1} title="기본 정보">
      <FormGrid>
        {/* 정본 #bldCode: 숫자만 3자리(글자는 입력하는 즉시 지운다). 지로 고객조회번호의 건물 코드 자리가 3자리다.
            등록 모드는 다음 번호가 미리 채워지고(순차 자동 채번, 2026-10-11) 직원이 고칠 수 있다. */}
        <TextField label="건물 코드" required placeholder="숫자 3자리" inputMode="numeric" maxLength={3} value={value.code} error={codeError} onChange={(v) => patch({ code: v.replace(/\D/g, "").slice(0, 3) })} />
        <TextField label="건물명" required placeholder="건물명 입력" value={value.name} onChange={(v) => patch({ name: v })} />
        <SelectField label="건물 유형" placeholder="선택" options={typeOptions} value={value.buildingType} onChange={(v) => patch({ buildingType: v })} />
        <TextField label="공동현관" placeholder="공동현관 비밀번호" value={value.gate} onChange={(v) => patch({ gate: v })} />
        <AddressField label="주소" required value={value.address} detail={value.addressDetail} onChange={(v) => patch({ address: v })} onDetailChange={(v) => patch({ addressDetail: v })} />
        <SelectField label="고지서 부과 그룹 유형" options={GROUP_TYPES} value={value.groupType} onChange={(v) => patch({ groupType: v })} />
        <SelectField label="수도 고객번호 보유" options={WATER_COUNTS} value={value.waterCount} onChange={(v) => patch({ waterCount: v })} />
        <DateField label="계약일" value={value.contractDate} onChange={(v) => patch({ contractDate: v })} />
        <DateField label="해지일" error={terminationError} value={value.terminationDate} onChange={(v) => patch({ terminationDate: v })} />
        <TextAreaField
          label="건물 상시 공지문"
          hint=" · 세입자 앱 홈의 건물 공지에 표시돼요"
          placeholder="예: 매주 화요일 오전 9시부터 11시까지 저수조 청소가 진행됩니다."
          footer="비워 두면 세입자 홈에 건물 공지가 표시되지 않아요"
          minHeight={100.79}
          lineHeight={1.6}
          value={value.standingNotice}
          onChange={(v) => patch({ standingNotice: v })}
        />
      </FormGrid>
    </CollapsibleFormSection>
  );
}
