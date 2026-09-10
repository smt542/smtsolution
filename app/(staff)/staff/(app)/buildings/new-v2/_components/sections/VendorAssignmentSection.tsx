"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
import { SelectField } from "../ui/SelectField";
import { Accordion } from "../ui/Accordion";
import { VendorCard } from "./VendorCard";
import { VENDORS } from "../config/vendors";
import type { RegisterFormState, RegisterVendorEntry } from "../config/formState";

const PROTOTYPE_VENDOR_ORDER = [
  "cleaning",
  "elevator_maint",
  "cctv",
  "internet",
  "fire",
  "septic",
  "elec_safety",
  "elevator_insp",
];

const DISPLAYED_VENDORS = PROTOTYPE_VENDOR_ORDER.map((key) => VENDORS.find((vendor) => vendor.key === key)).filter(
  (vendor): vendor is (typeof VENDORS)[number] => vendor !== undefined,
);

/** ② 업체 및 담당자 지정 (Figma 673:55789). */
export function VendorAssignmentSection({
  value,
  patch,
  staffOptions,
  showAllVendors = false,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
  staffOptions: string[];
  showAllVendors?: boolean;
}) {
  const setVendor = (key: string, next: RegisterVendorEntry) =>
    patch({ vendors: { ...value.vendors, [key]: next } });
  const displayedVendors = showAllVendors ? VENDORS : DISPLAYED_VENDORS;

  return (
    <CollapsibleFormSection index={2} title="업체 및 담당자 지정">
      <FormGrid>
        <SelectField label="사무 담당자" required variant="staff" options={staffOptions} value={value.officeManager} onChange={(v) => patch({ officeManager: v })} />
        <SelectField label="현장 관리자" required variant="staff" options={staffOptions} value={value.siteManager} onChange={(v) => patch({ siteManager: v })} />
      </FormGrid>
      <div className="pt-[14px]">
        {displayedVendors.map((vd) => (
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
