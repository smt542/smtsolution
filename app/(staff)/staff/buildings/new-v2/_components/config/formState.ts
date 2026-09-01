import type {
  Building,
  BuildingExtraInfo,
  BuildingUtilityEntry,
  BuildingVendorDetails,
  BuildingVendorEntry,
  SaveBuildingPayload,
} from "@/hooks/reactquery/buildings";
import { emptyFacilities } from "@/hooks/reactquery/buildings";
import { VENDORS } from "./vendors";
import { UTILITIES } from "./utilities";

/** 재설계 6-섹션 폼의 단일 상태 형태(라벨 키 기반, 프로토타입 필드 그대로 왕복). */
export interface RegisterFormState {
  // ① 기본 정보
  code: string;
  name: string;
  buildingType: string; // building_types 라벨
  gate: string; // 공동현관 = entrance_password
  address: string;
  addressDetail: string;
  groupType: string;
  waterCount: string;
  contractDate: string;
  terminationDate: string;
  standingNotice: string;
  // ② 업체 및 담당자
  officeManager: string; // 직원 이름 라벨 → manager_user_id
  siteManager: string; // 직원 이름 라벨 → meter_user_id
  vendors: Record<string, BuildingVendorEntry>;
  // ③ 적립금
  reserveFundType: string;
  reserveFundMemo: string;
  // ④ 건물주 정보
  ownerName: string;
  ownerPhone: string;
  ownerPhoneSub: string;
  ownerAddress: string;
  ownerAddressDetail: string;
  ownerMemo: string;
  // ⑤ 부가 정보
  utilities: Record<string, BuildingUtilityEntry>;
  refNote: string; // 부과시 참조사항 = billing_note
  // ⑥ 건물 메모
  memo: string;
}

const emptyVendors = (): Record<string, BuildingVendorEntry> =>
  Object.fromEntries(VENDORS.map((v) => [v.key, { fields: {}, memo: "" }]));

const emptyUtilities = (): Record<string, BuildingUtilityEntry> =>
  Object.fromEntries(UTILITIES.map((u) => [u.key, { cards: [{}], extra: {} }]));

export function initialFormState(): RegisterFormState {
  return {
    code: "", name: "", buildingType: "", gate: "", address: "", addressDetail: "",
    groupType: "1", waterCount: "1", contractDate: "", terminationDate: "", standingNotice: "",
    officeManager: "", siteManager: "", vendors: emptyVendors(),
    reserveFundType: "적립금", reserveFundMemo: "",
    ownerName: "", ownerPhone: "", ownerPhoneSub: "", ownerAddress: "", ownerAddressDetail: "", ownerMemo: "",
    utilities: emptyUtilities(), refNote: "",
    memo: "",
  };
}

/** 저장된 유틸/업체 JSONB를 초기 스켈레톤과 병합(모든 key 존재 보장). */
function mergeVendors(saved?: Record<string, BuildingVendorEntry> | null): Record<string, BuildingVendorEntry> {
  const base = emptyVendors();
  if (saved) for (const k of Object.keys(base)) if (saved[k]) base[k] = { fields: { ...saved[k].fields }, memo: saved[k].memo ?? "" };
  return base;
}
function mergeUtilities(saved?: Record<string, BuildingUtilityEntry> | null): Record<string, BuildingUtilityEntry> {
  const base = emptyUtilities();
  if (saved)
    for (const k of Object.keys(base))
      if (saved[k]) {
        const cards = Array.isArray(saved[k].cards) && saved[k].cards.length > 0 ? saved[k].cards.map((c) => ({ ...c })) : [{}];
        base[k] = { cards, extra: { ...(saved[k].extra ?? {}) } };
      }
  return base;
}

/** 수정 모드 하이드레이션: Building + 담당자/유형 라벨 해석기 → 폼 상태. */
export function buildingToFormState(
  b: Building,
  resolveStaffName: (userId: string | null) => string,
  resolveTypeLabel: (typeId: number | null) => string,
): RegisterFormState {
  const be = b.basicExtra;
  const oe = b.ownerExtra;
  const rf = b.reserveFund;
  return {
    code: b.code ?? "",
    name: b.name ?? "",
    buildingType: resolveTypeLabel(b.typeId) || be?.buildingTypeLabel || "",
    gate: b.entrancePassword ?? "",
    address: b.address ?? "",
    addressDetail: be?.addressDetail ?? "",
    groupType: be?.groupType ?? "1",
    waterCount: be?.waterCount ?? "1",
    contractDate: be?.contractDate ?? "",
    terminationDate: be?.terminationDate ?? "",
    standingNotice: be?.standingNotice ?? "",
    officeManager: resolveStaffName(b.managerUserId),
    siteManager: resolveStaffName(b.meterUserId),
    vendors: mergeVendors(b.vendorDetails?.vendors),
    reserveFundType: rf?.type ?? "적립금",
    reserveFundMemo: rf?.memo ?? "",
    ownerName: b.ownerName ?? "",
    ownerPhone: b.ownerPhone ?? "",
    ownerPhoneSub: oe?.phoneSub ?? "",
    ownerAddress: oe?.address ?? "",
    ownerAddressDetail: oe?.addressDetail ?? "",
    ownerMemo: oe?.memo ?? "",
    utilities: mergeUtilities(b.extraInfo?.utilities),
    refNote: b.billingNote ?? "",
    memo: b.memo ?? "",
  };
}

/** 폼 상태 → 저장 페이로드. 담당자/유형 라벨은 id로 해석해 넘긴다. 폼이 관리하지 않는 값은 carry 로 보존. */
export function formStateToPayload(
  s: RegisterFormState,
  opts: {
    id: number | null;
    resolveStaffId: (name: string) => string | null;
    resolveTypeId: (label: string) => number | null;
    carry: { cleaningUserId: string | null; facilities: Building["facilities"] | null };
  },
): SaveBuildingPayload {
  const extraInfo: BuildingExtraInfo = { utilities: s.utilities };
  const vendorDetails: BuildingVendorDetails = { vendors: s.vendors };
  return {
    id: opts.id,
    code: s.code || undefined,
    name: s.name.trim(),
    address: s.address || null,
    managerUserId: opts.resolveStaffId(s.officeManager),
    meterUserId: opts.resolveStaffId(s.siteManager),
    cleaningUserId: opts.carry.cleaningUserId,
    facilities: opts.carry.facilities ?? emptyFacilities(),
    memo: s.memo || null,
    customerNumbers: [],
    vendors: [],
    typeId: opts.resolveTypeId(s.buildingType),
    entrancePassword: s.gate || null,
    ownerName: s.ownerName || null,
    ownerPhone: s.ownerPhone || null,
    billingNote: s.refNote || null,
    reserveFund: { type: s.reserveFundType, memo: s.reserveFundMemo },
    ownerExtra: {
      phoneSub: s.ownerPhoneSub, address: s.ownerAddress,
      addressDetail: s.ownerAddressDetail, memo: s.ownerMemo,
    },
    basicExtra: {
      groupType: s.groupType, waterCount: s.waterCount, contractDate: s.contractDate,
      terminationDate: s.terminationDate, standingNotice: s.standingNotice,
      addressDetail: s.addressDetail, buildingTypeLabel: s.buildingType,
    },
    extraInfo,
    vendorDetails,
  };
}
