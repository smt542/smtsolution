import type {
  Building,
  BuildingExtraInfo,
  BuildingFull,
  BuildingUtilityEntry,
  BuildingVendorDetails,
  SaveBuildingPayload,
} from "@/hooks/reactquery/buildings";
import { emptyFacilities } from "@/hooks/reactquery/buildings";
import type { BuildingCustomerNumber } from "@/hooks/reactquery/buildingCustomerNumbers";
import type { BuildingVendor, VendorType } from "@/hooks/reactquery/buildingVendors";
import { VENDORS } from "./vendors";
import { UTILITIES } from "./utilities";

export interface RegisterUtilityCard {
  fields: Record<string, string>;
  normalized?: BuildingCustomerNumber;
}

export interface RegisterUtilityEntry {
  cards: RegisterUtilityCard[];
  extra: Record<string, string>;
  deletedIds: number[];
}

export interface RegisterVendorEntry {
  fields: Record<string, string>;
  memo: string;
  normalized?: BuildingVendor;
}

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
  vendors: Record<string, RegisterVendorEntry>;
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
  utilities: Record<string, RegisterUtilityEntry>;
  refNote: string; // 부과시 참조사항 = billing_note
  // ⑥ 건물 메모
  memo: string;
}

const VENDOR_TYPES: Record<string, VendorType> = {
  cleaning: "etc",
  septic: "septic",
  internet: "etc",
  elec_safety: "electric",
  cable: "etc",
  elevator_maint: "elevator",
  elevator_insp: "elevator",
  fire: "fire",
  cctv: "etc",
};

const NORMALIZED_UTILITY_FIELDS = new Set([
  "고객번호", "성명", "계약명", "계약자", "월분", "계산", "계산1", "조회",
  "검침일", "검침", "고지기간 출력", "메모",
]);
const NORMALIZED_VENDOR_FIELDS = new Set(["업체명", "전화번호"]);

const emptyVendors = (): Record<string, RegisterVendorEntry> =>
  Object.fromEntries(VENDORS.map((v) => [v.key, { fields: {}, memo: "" }]));

const emptyUtilities = (): Record<string, RegisterUtilityEntry> =>
  Object.fromEntries(UTILITIES.map((u) => [u.key, { cards: [{ fields: {} }], extra: {}, deletedIds: [] }]));

export function initialFormState(): RegisterFormState {
  return {
    code: "", name: "", buildingType: "빌라", gate: "", address: "", addressDetail: "",
    groupType: "1", waterCount: "1", contractDate: "", terminationDate: "", standingNotice: "",
    officeManager: "", siteManager: "", vendors: emptyVendors(),
    reserveFundType: "적립금", reserveFundMemo: "",
    ownerName: "", ownerPhone: "", ownerPhoneSub: "", ownerAddress: "", ownerAddressDetail: "", ownerMemo: "",
    utilities: emptyUtilities(), refNote: "",
    memo: "",
  };
}

function nonEmptyFields(fields: Record<string, string>, excluded: Set<string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([label, value]) => !excluded.has(label) && value.trim() !== ""),
  );
}

function meterDayLabel(kind: string): string {
  return kind === "gas" ? "검침" : "검침일";
}

function holderLabel(kind: string): string {
  if (kind === "water") return "성명";
  if (kind === "gas") return "계약자";
  return "계약명";
}

function calculationLabel(kind: string): string | null {
  if (kind === "water") return "계산";
  if (kind === "elec" || kind === "gas") return "계산1";
  return null;
}

function normalizedCustomerNumberFields(row: BuildingCustomerNumber): Record<string, string> {
  const fields: Record<string, string> = {
    고객번호: row.customerNo,
    월분: row.billingBasis === "prev" ? "전월" : "당월",
    조회: row.lineName ?? "",
    메모: row.note ?? "",
    [holderLabel(row.kind)]: row.holderName ?? "",
    [meterDayLabel(row.kind)]: row.meterDay == null ? "" : `${row.meterDay}일`,
  };
  const calcLabel = calculationLabel(row.kind);
  if (calcLabel) fields[calcLabel] = row.calculationMethod === "manual" ? "수동" : "자동";
  if (row.kind !== "common_elec") fields["고지기간 출력"] = row.printOnBill ? "Y" : "N";
  return fields;
}

/** JSONB의 보충 필드와 정규화 고객번호를 카드 순서대로 병합한다. */
function mergeUtilities(
  saved: Record<string, BuildingUtilityEntry> | null | undefined,
  normalized: BuildingCustomerNumber[],
): Record<string, RegisterUtilityEntry> {
  const base = emptyUtilities();
  for (const utility of UTILITIES) {
    const savedEntry = saved?.[utility.key];
    const savedCards = Array.isArray(savedEntry?.cards) ? savedEntry.cards : [];
    const rows = normalized.filter((row) => row.kind === utility.key);
    const count = Math.max(savedCards.length, rows.length, 1);
    base[utility.key] = {
      cards: Array.from({ length: count }, (_, index) => ({
        fields: {
          ...(savedCards[index] ?? {}),
          ...(rows[index] ? normalizedCustomerNumberFields(rows[index]) : {}),
        },
        normalized: rows[index],
      })),
      extra: { ...(savedEntry?.extra ?? {}) },
      deletedIds: [],
    };
  }
  return base;
}

/** JSONB의 업체별 보충 필드와 정규화 업체를 유형/순서에 맞춰 병합한다. */
function mergeVendors(
  saved: BuildingVendorDetails["vendors"] | null | undefined,
  normalized: BuildingVendor[],
): Record<string, RegisterVendorEntry> {
  const base = emptyVendors();
  for (const key of Object.keys(base)) {
    const savedEntry = saved?.[key];
    if (savedEntry) {
      base[key] = { fields: { ...savedEntry.fields }, memo: savedEntry.memo ?? "" };
    }
  }

  const assigned = new Set<string>();
  for (const row of normalized) {
    const candidates = VENDORS.map((vendor) => vendor.key)
      .filter((key) => VENDOR_TYPES[key] === row.vendorType && !assigned.has(key));
    const exact = candidates.find((key) => saved?.[key]?.fields?.["업체명"] === row.name);
    const marked = candidates.find((key) => saved?.[key]?.assigned === true)
      ?? candidates.find((key) => saved?.[key]?.fields?.["업체명"] !== undefined);
    const key = exact ?? marked ?? candidates[0];
    if (!key) continue;
    assigned.add(key);
    base[key] = {
      fields: {
        ...base[key].fields,
        업체명: row.name,
        전화번호: row.phone ?? "",
      },
      memo: row.memo ?? "",
      normalized: row,
    };
  }
  return base;
}

/** 수정 모드 하이드레이션: 건물 + 정규화 고객번호/업체 + 라벨 해석기 → 폼 상태. */
export function buildingToFormState(
  b: BuildingFull,
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
    vendors: mergeVendors(b.vendorDetails?.vendors, b.vendors),
    reserveFundType: rf?.type ?? "적립금",
    reserveFundMemo: rf?.memo ?? "",
    ownerName: b.ownerName ?? "",
    ownerPhone: b.ownerPhone ?? "",
    ownerPhoneSub: oe?.phoneSub ?? "",
    ownerAddress: oe?.address ?? "",
    ownerAddressDetail: oe?.addressDetail ?? "",
    ownerMemo: oe?.memo ?? "",
    utilities: mergeUtilities(b.extraInfo?.utilities, b.customerNumbers),
    refNote: b.billingNote ?? "",
    memo: b.memo ?? "",
  };
}

function parseMeterDay(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : null;
}

function customerNumbersFromState(s: RegisterFormState): SaveBuildingPayload["customerNumbers"] {
  const active: SaveBuildingPayload["customerNumbers"] = [];
  for (const utility of UTILITIES) {
    const entry = s.utilities[utility.key];
    for (const card of entry?.cards ?? []) {
      const customerNo = card.fields["고객번호"]?.trim() ?? "";
      if (!customerNo) {
        if (card.normalized?.id) {
          active.push({
            id: card.normalized.id,
            kind: card.normalized.kind,
            customerNo: "",
            billingBasis: "current",
            printOnBill: true,
            _deleted: true,
          });
        }
        continue;
      }
      const calcLabel = calculationLabel(utility.key);
      const printValue = card.fields["고지기간 출력"];
      active.push({
        id: card.normalized?.id,
        kind: utility.key as SaveBuildingPayload["customerNumbers"][number]["kind"],
        customerNo,
        meterDay: parseMeterDay(card.fields[meterDayLabel(utility.key)]),
        billingBasis: card.fields["월분"] === "전월" ? "prev" : "current",
        printOnBill: printValue ? printValue !== "N" : card.normalized?.printOnBill ?? true,
        holderName: card.fields[holderLabel(utility.key)]?.trim() || null,
        lineName: card.fields["조회"]?.trim() || null,
        calculationMethod: utility.key === "common_elec"
          ? "auto"
          : card.fields[calcLabel ?? ""] === "수동" ? "manual" : "auto",
        note: card.fields["메모"]?.trim() || null,
      });
    }
  }

  const deletedIds = new Set(
    UTILITIES.flatMap((utility) => s.utilities[utility.key]?.deletedIds ?? []),
  );
  const activeIds = new Set(active.flatMap((row) => row._deleted || row.id == null ? [] : [row.id]));
  for (const id of deletedIds) {
    if (activeIds.has(id) || active.some((row) => row.id === id && row._deleted)) continue;
    active.push({
      id,
      kind: "water",
      customerNo: "",
      billingBasis: "current",
      printOnBill: true,
      _deleted: true,
    });
  }
  let sortOrder = 0;
  return active.map((row) => row._deleted ? row : { ...row, sortOrder: sortOrder++ });
}

function vendorsFromState(s: RegisterFormState): SaveBuildingPayload["vendors"] {
  const rows: SaveBuildingPayload["vendors"] = [];
  for (const [sortOrder, vendor] of VENDORS.entries()) {
    const entry = s.vendors[vendor.key];
    const name = entry?.fields["업체명"]?.trim() ?? "";
    if (!name) {
      if (entry?.normalized?.id) {
        rows.push({
          id: entry.normalized.id,
          vendorType: VENDOR_TYPES[vendor.key],
          name: "",
          sortOrder,
          _deleted: true,
        });
      }
      continue;
    }
    rows.push({
      id: entry.normalized?.id,
      clientKey: entry.normalized?.id ? undefined : `register-${vendor.key}`,
      vendorType: VENDOR_TYPES[vendor.key],
      name,
      phone: entry.fields["전화번호"]?.trim() || null,
      memo: entry.memo.trim() || null,
      sortOrder,
    });
  }
  return rows;
}

function supplementaryExtraInfo(s: RegisterFormState): BuildingExtraInfo | null {
  const utilities: Record<string, BuildingUtilityEntry> = {};
  for (const utility of UTILITIES) {
    const entry = s.utilities[utility.key];
    if (!entry) continue;
    const cards = entry.cards.map((card) => nonEmptyFields(card.fields, NORMALIZED_UTILITY_FIELDS));
    const extra = nonEmptyFields(entry.extra, new Set());
    if (cards.some((card) => Object.keys(card).length > 0) || Object.keys(extra).length > 0) {
      utilities[utility.key] = { cards, extra };
    }
  }
  return Object.keys(utilities).length > 0 ? { utilities } : null;
}

function supplementaryVendorDetails(s: RegisterFormState): BuildingVendorDetails | null {
  const vendors: BuildingVendorDetails["vendors"] = {};
  for (const vendor of VENDORS) {
    const entry = s.vendors[vendor.key];
    if (!entry) continue;
    const fields = nonEmptyFields(entry.fields, NORMALIZED_VENDOR_FIELDS);
    if (entry.fields["업체명"]?.trim() || Object.keys(fields).length > 0) {
      // 객체 key 자체가 좁은 vendor_type으로 표현할 수 없는 업체 역할을 보존한다.
      vendors[vendor.key] = {
        fields,
        ...(entry.fields["업체명"]?.trim() ? { assigned: true } : {}),
      };
    }
  }
  return Object.keys(vendors).length > 0 ? { vendors } : null;
}

/** 폼 상태 → 저장 페이로드. 정규화 가능한 고객번호/업체는 JSONB가 아닌 전용 배열로 보낸다. */
export function formStateToPayload(
  s: RegisterFormState,
  opts: {
    id: number | null;
    resolveStaffId: (name: string) => string | null;
    resolveTypeId: (label: string) => number | null;
    carry: { cleaningUserId: string | null; facilities: Building["facilities"] | null };
  },
): SaveBuildingPayload {
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
    customerNumbers: customerNumbersFromState(s),
    vendors: vendorsFromState(s),
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
    extraInfo: supplementaryExtraInfo(s),
    vendorDetails: supplementaryVendorDetails(s),
  };
}
