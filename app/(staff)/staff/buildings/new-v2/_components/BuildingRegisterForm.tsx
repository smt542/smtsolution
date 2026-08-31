"use client";
import { RegisterHeader } from "./RegisterHeader";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { VendorAssignmentSection } from "./sections/VendorAssignmentSection";
import { ReserveFundSection } from "./sections/ReserveFundSection";
import { OwnerInfoSection } from "./sections/OwnerInfoSection";
import { ExtraInfoSection } from "./sections/ExtraInfoSection";
import { BuildingMemoSection } from "./sections/BuildingMemoSection";

/**
 * 건물 등록 재설계(미리보기) — Figma node 673:55474.
 * UI 우선: 로컬 폼 상태만 유지하며 저장 배선은 후속 작업.
 */
export function BuildingRegisterForm() {
  return (
    <div className="flex flex-col">
      <RegisterHeader />
      <div className="flex flex-col gap-[16px] p-[24px]">
        <BasicInfoSection />
        <VendorAssignmentSection />
        <ReserveFundSection />
        <OwnerInfoSection />
        <ExtraInfoSection />
        <BuildingMemoSection />
      </div>
    </div>
  );
}
