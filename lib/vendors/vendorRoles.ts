import type { VendorType } from "@/hooks/reactquery/buildingVendors/apis";

/**
 * 업체 역할(협력업체 구분) 단일 소스 — QA #50 #51.
 * 배열 순서 = 협력업체 관리 / 건물 등록·상세 / 현장 모바일 공통 표시 순서.
 * DB: vendor_categories.sort_order(0~7), building_vendors.vendor_role, partner_list_building_vendors 정렬과 일치해야 한다.
 */
export const VENDOR_ROLES = [
  { key: "cleaning", title: "청소 업체", vendorType: "etc" },
  { key: "elevator_maint", title: "승강기보수업체", vendorType: "elevator" },
  { key: "cctv", title: "CCTV 업체", vendorType: "etc" },
  { key: "internet", title: "인터넷 업체", vendorType: "etc" },
  { key: "fire", title: "소방검사업체", vendorType: "fire" },
  { key: "septic", title: "정화조 업체", vendorType: "septic" },
  { key: "elec_safety", title: "전기안전업체", vendorType: "electric" },
  { key: "elevator_insp", title: "승강기정기검사업체", vendorType: "elevator" },
] as const satisfies readonly { key: string; title: string; vendorType: VendorType }[];

export type VendorRoleKey = (typeof VENDOR_ROLES)[number]["key"];

const ROLE_INDEX: Map<string, number> = new Map(VENDOR_ROLES.map((r, i) => [r.key, i]));

export const vendorRoleTitle = (key: string | null | undefined): string | undefined =>
  VENDOR_ROLES.find((r) => r.key === key)?.title;

export const vendorRoleType = (key: string): VendorType =>
  VENDOR_ROLES.find((r) => r.key === key)?.vendorType ?? "etc";

/** 역할 순서 비교(알 수 없는 역할은 뒤). */
export const compareVendorRole = (a: string | null | undefined, b: string | null | undefined): number =>
  (a != null ? ROLE_INDEX.get(a) ?? 999 : 999) - (b != null ? ROLE_INDEX.get(b) ?? 999 : 999);

/** 숨김 처리하는 구분(유선방송정보업체는 고정 8종에서 제외). */
export const HIDDEN_CATEGORY_LABELS = ["유선방송정보업체"];
