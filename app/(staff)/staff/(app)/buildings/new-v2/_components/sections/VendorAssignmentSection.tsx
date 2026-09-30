"use client";
import { CollapsibleFormSection } from "@/components/common/CollapsibleFormSection";
import { FormGrid } from "@/components/common/FormGrid";
import { SelectField } from "../ui/SelectField";
import { Accordion } from "../ui/Accordion";
import { VendorCard, type VendorNameOptions } from "./VendorCard";
import { VENDORS } from "../config/vendors";
import type { RegisterFormState, RegisterVendorEntry } from "../config/formState";
import type { Attachment } from "@/hooks/reactquery/attachments";
import { useVendorCategories } from "@/hooks/reactquery/vendorCategories";
import { useVendors } from "@/hooks/reactquery/vendors";

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
  attachments = [],
  onDeleteAttachment,
  disabled = false,
}: {
  value: RegisterFormState;
  patch: (p: Partial<RegisterFormState>) => void;
  staffOptions: string[];
  showAllVendors?: boolean;
  attachments?: Attachment[];
  onDeleteAttachment?: (attachment: Attachment) => Promise<void>;
  disabled?: boolean;
}) {
  const setVendor = (key: string, next: RegisterVendorEntry) =>
    patch({ vendors: { ...value.vendors, [key]: next } });
  const displayedVendors = showAllVendors ? VENDORS : DISPLAYED_VENDORS;

  // 정본 CATMAP처럼 아코디언 제목 = 협력업체 관리 구분 이름으로 잇는다. 맞는 구분이 없으면 업체명을 직접 입력한다.
  const categories = useVendorCategories();
  const vendors = useVendors();
  const nameOptionsFor = (title: string): VendorNameOptions | null => {
    if (categories.isPending) return { loading: true, vendors: [] };
    const category = categories.data?.find((c) => c.label === title);
    if (!category) return null;
    return {
      loading: vendors.isPending,
      vendors: (vendors.data ?? []).filter((vendor) => vendor.categoryId === category.id),
    };
  };

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
              value={value.vendors[vd.key] ?? { fields: {}, memo: "", pendingFiles: [] }}
              onChange={(next) => setVendor(vd.key, next)}
              nameOptions={nameOptionsFor(vd.title)}
              attachments={attachments.filter((attachment) =>
                attachment.entityId === (value.vendors[vd.key]?.persistedId ?? value.vendors[vd.key]?.normalized?.id)
              )}
              onDeleteAttachment={onDeleteAttachment}
              disabled={disabled}
            />
          </Accordion>
        ))}
      </div>
    </CollapsibleFormSection>
  );
}
