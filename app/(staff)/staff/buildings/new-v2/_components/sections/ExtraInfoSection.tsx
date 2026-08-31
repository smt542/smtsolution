"use client";
import { useState } from "react";
import { FormSection } from "../ui/FormSection";
import { Accordion } from "../ui/Accordion";
import { UtilityPanel } from "./UtilityPanel";
import { TextAreaField } from "../ui/TextAreaField";
import { UTILITIES, GAS_EXTRA } from "../config/utilities";

/** ⑤ 부가 정보 (Figma 673:56714). */
export function ExtraInfoSection() {
  const [ref, setRef] = useState("");
  return (
    <FormSection index={5} title="부가 정보">
      <div>
        {UTILITIES.map((u) => (
          <Accordion key={u.key} title={u.title}>
            <UtilityPanel fields={u.fields} extra={u.key === "gas" ? GAS_EXTRA : undefined} />
          </Accordion>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px] pt-[16px]">
        <TextAreaField
          label="부과시 참조사항"
          placeholder="관리비 부과 세팅 화면에 표시할 참조사항"
          value={ref}
          onChange={setRef}
        />
      </div>
    </FormSection>
  );
}
