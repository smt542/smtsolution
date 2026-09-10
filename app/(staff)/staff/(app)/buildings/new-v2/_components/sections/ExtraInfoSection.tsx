"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { Accordion } from "../ui/Accordion";
import { UtilityPanel } from "./UtilityPanel";
import { TextAreaField } from "../ui/TextAreaField";
import { UTILITIES, GAS_EXTRA } from "../config/utilities";
import type { RegisterFormState, RegisterUtilityEntry } from "../config/formState";

/** ⑤ 부가 정보 (Figma 673:56714). */
export function ExtraInfoSection({
  value,
  patch,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
}) {
  const setUtility = (key: string, next: RegisterUtilityEntry) =>
    patch({ utilities: { ...value.utilities, [key]: next } });

  return (
    <CollapsibleFormSection index={5} title="부가 정보">
      <div>
        {UTILITIES.map((u) => (
          <Accordion key={u.key} title={u.title}>
            <UtilityPanel
              fields={u.fields}
              extra={u.key === "gas" ? GAS_EXTRA : undefined}
              value={value.utilities[u.key] ?? { cards: [{ fields: {} }], extra: {}, deletedIds: [] }}
              onChange={(next) => setUtility(u.key, next)}
            />
          </Accordion>
        ))}
      </div>
      <div className="mt-[14px] grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <TextAreaField
          label="부과시 참조사항"
          placeholder="관리비 부과 세팅 화면에 표시할 참조사항"
          value={value.refNote}
          onChange={(v) => patch({ refNote: v })}
          minHeight={72}
        />
      </div>
    </CollapsibleFormSection>
  );
}
