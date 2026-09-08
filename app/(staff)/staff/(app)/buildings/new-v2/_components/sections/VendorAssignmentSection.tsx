"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
import { SelectField } from "../ui/SelectField";
import { Accordion } from "../ui/Accordion";
import { VendorCard } from "./VendorCard";
import { VENDORS } from "../config/vendors";
import type { RegisterFormState, RegisterVendorEntry } from "../config/formState";

/** ② 업체 및 담당자 지정 (Figma 673:55789). */
export function VendorAssignmentSection({
  value,
  patch,
  staffOptions,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
  staffOptions: string[];
}) {
  const setVendor = (key: string, next: RegisterVendorEntry) =>
    patch({ vendors: { ...value.vendors, [key]: next } });

  return (
    <CollapsibleFormSection index={2} title="업체 및 담당자 지정">
      <FormGrid>
        <SelectField label="사무 담당자" placeholder="직원 선택" options={staffOptions} value={value.officeManager} onChange={(v) => patch({ officeManager: v })} />
        <SelectField label="현장 관리자" placeholder="직원 선택" options={staffOptions} value={value.siteManager} onChange={(v) => patch({ siteManager: v })} />
      </FormGrid>
      <div>
        {VENDORS.map((vd) => (
          <Accordion key={vd.key} title={vd.title}>
            <VendorCard
              fields={vd.fields}
              value={value.vendors[vd.key] ?? { fields: {}, memo: "" }}
              onChange={(next) => setVendor(vd.key, next)}
            />
          </Accordion>
        ))}
      </div>
    </CollapsibleFormSection>
  );
}
