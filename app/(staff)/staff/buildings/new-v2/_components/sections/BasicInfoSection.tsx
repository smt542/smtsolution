"use client";
import { useState } from "react";
import { FormSection } from "../ui/FormSection";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { DateField } from "../ui/DateField";
import { AddressField } from "../ui/AddressField";
import { TextAreaField } from "../ui/TextAreaField";

const BUILDING_TYPES = ["빌라", "아파트", "오피스텔", "도시형생활주택", "다가구주택", "상가", "기타"];
const GROUP_TYPES = ["1", "2", "3", "4", "5"];
const WATER_COUNTS = ["1", "2", "3", "4", "5", "6", "7", "8", "10"];

/** ① 기본 정보 (Figma 673:55665). */
export function BasicInfoSection() {
  const [v, setV] = useState<Record<string, string>>({ type: "빌라", group: "1", water: "1" });
  const set = (k: string) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <FormSection index={1} title="기본 정보">
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <TextField label="건물 코드" required placeholder="숫자 3자리" inputMode="numeric" value={v.code} onChange={set("code")} />
        <TextField label="건물명" placeholder="건물명 입력" value={v.name} onChange={set("name")} />
        <SelectField label="건물 유형" options={BUILDING_TYPES} value={v.type} onChange={set("type")} />
        <TextField label="공동현관" placeholder="공동현관 비밀번호" value={v.gate} onChange={set("gate")} />
        <AddressField label="주소" required />
        <SelectField label="고지서 부과 그룹 유형" options={GROUP_TYPES} value={v.group} onChange={set("group")} />
        <SelectField label="수도 고객번호 보유" options={WATER_COUNTS} value={v.water} onChange={set("water")} />
        <DateField label="계약일" value={v.contract} onChange={set("contract")} />
        <DateField label="해지일" value={v.terminate} onChange={set("terminate")} />
        <TextAreaField
          label="건물 상시 공지문"
          hint=" · 세입자 앱 홈의 건물 공지에 표시돼요"
          placeholder="예: 매주 화요일 오전 9시부터 11시까지 저수조 청소가 진행됩니다."
          footer="비워 두면 세입자 홈에 건물 공지가 표시되지 않아요"
          value={v.notice}
          onChange={set("notice")}
        />
      </div>
    </FormSection>
  );
}
