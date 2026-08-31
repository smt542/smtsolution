"use client";
import { useState } from "react";
import { FormSection } from "../ui/FormSection";
import { SelectField } from "../ui/SelectField";
import { Accordion } from "../ui/Accordion";
import { VendorCard } from "./VendorCard";
import { VENDORS } from "../config/vendors";

const OFFICE_STAFF = ["김민수", "이수진", "박정우", "최유나"];
const SITE_MANAGERS = ["관리인 A", "관리인 B", "관리인 C"];

/** ② 업체 및 담당자 지정 (Figma 673:55789). */
export function VendorAssignmentSection() {
  const [office, setOffice] = useState("");
  const [manager, setManager] = useState("");
  return (
    <FormSection index={2} title="업체 및 담당자 지정">
      <div className="grid grid-cols-2 gap-x-[18px] gap-y-[16px]">
        <SelectField label="사무 담당자" required options={OFFICE_STAFF} value={office} onChange={setOffice} />
        <SelectField label="현장 관리자" required options={SITE_MANAGERS} value={manager} onChange={setManager} />
      </div>
      <div>
        {VENDORS.map((vd) => (
          <Accordion key={vd.key} title={vd.title}>
            <VendorCard fields={vd.fields} />
          </Accordion>
        ))}
      </div>
    </FormSection>
  );
}
