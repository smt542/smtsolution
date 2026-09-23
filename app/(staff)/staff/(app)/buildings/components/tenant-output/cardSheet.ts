import type { Building, BuildingFull } from "@/hooks/reactquery/buildings";
import type { TenantCardSheetRow } from "@/hooks/reactquery/tenantOutput";
import { formatDate, formatNumber, formatPhone } from "@/lib/format";
import { mergeVendors } from "../../new-v2/_components/config/formState";

/** 입주자카드 한 쪽의 세대 수(정본 CARD_ROWS). */
export const CARD_UNITS_PER_PAGE = 12;

export interface CardSheetHeader {
  code: string;
  dongName: string;
  address: string;
  name: string;
  phone: string;
  company: string;
  keyLine: string;
  memo: string;
}
export interface CardVendorBlocks {
  cleaning: { manager: string; frequency: string; weekdays: string; amount: string; remarks: string };
  septic: { vendor: string; phone: string; amount: string; billingType: string };
  internet: { vendor: string; holder: string; amount: string };
}
export interface CardNumberLine {
  lin: number;
  customerNo: string;
  holderName: string;
  basis: string;
  calculation: string;
  meterDay: string;
  print: string;
  note: string;
}
export interface CardUnitLine {
  key: string;
  unitNo: string;
  name: string;
  roomType: string;
  residents: string;
  area: string;
  homePhone: string;
  mobilePhone: string;
  moveIn: string;
  mgmtFee: string;
  afterIncrease: string;
  increase: string;
  entranceKey: string;
}
export interface CardSheetPage {
  key: string;
  building: Building;
  header: CardSheetHeader;
  blocks: CardVendorBlocks;
  water: CardNumberLine[];
  commonElec: CardNumberLine[];
  units: CardUnitLine[];
  /** 건물 안에서의 쪽 번호(0부터). */
  pageIndex: number;
  pageCount: number;
}
/** 조직 단위 값(회사명·대표전화·청소 담당자 이름 조회). */
export interface CardOrgInfo {
  companyName: string;
  companyPhone: string;
  cleaningManagerName: (userId: string | null) => string;
}

type CustomerNumberRow = BuildingFull["customerNumbers"][number];

const text = (value: string | null | undefined) => (value ?? "").trim();
/** 정본·PDF 표기: 호수 끝의 "호"를 뗀다(D12). */
export const unitLabel = (unitNo: string) => unitNo.replace(/호$/, "");
/** 호수 숫자순(101 < 201 < 1001). */
export const compareUnitNo = (a: string, b: string) => a.localeCompare(b, "ko-KR", { numeric: true });
const phoneText = (value: string | null) => (text(value) ? formatPhone(text(value)) : "");

function numberLines(rows: CustomerNumberRow[], kind: "water" | "common_elec"): CardNumberLine[] {
  return rows
    .filter((row) => row.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, index) => ({
      lin: index + 1,
      customerNo: row.customerNo,
      holderName: text(row.holderName),
      basis: row.billingBasis === "prev" ? "전월" : "당월",
      calculation: row.calculationMethod === "manual" ? "수동" : "자동",
      meterDay: row.meterDay == null ? "" : String(row.meterDay),
      print: row.printOnBill ? "Y" : "N",
      note: text(row.note),
    }));
}

function unitLine(row: TenantCardSheetRow): CardUnitLine {
  const vacant = row.isVacant;
  const fee = vacant ? null : row.mgmtFeeAmount;
  const increase = vacant ? 0 : (row.increaseAmount ?? 0);
  return {
    key: String(row.unitId),
    unitNo: unitLabel(row.unitNo),
    name: vacant ? "" : text(row.tenantName),
    roomType: text(row.roomTypeLabel),
    residents: vacant || row.residentCount == null ? "" : String(row.residentCount),
    area: formatNumber(row.areaPyeong, { nullText: "", fractionDigits: 2 }),
    homePhone: vacant ? "" : phoneText(row.phone3),
    mobilePhone: vacant ? "" : phoneText(row.phone),
    moveIn: vacant ? "" : formatDate(row.moveInDate, { nullText: "" }),
    mgmtFee: formatNumber(fee, { nullText: "" }),
    // D7: 인상 계획이 있을 때만 인상후·인상폭을 찍는다.
    afterIncrease: fee != null && increase > 0 ? formatNumber(fee + increase, { nullText: "" }) : "",
    increase: increase > 0 ? formatNumber(increase, { nullText: "" }) : "",
    entranceKey: vacant ? "N 공실" : "Y",
  };
}

/** 건물 1곳의 입주자카드 쪽들(공실 포함 전 세대, 쪽당 12세대, 최소 1쪽 — D2). */
export function buildCardSheetPages(
  building: Building,
  full: BuildingFull | null,
  rows: TenantCardSheetRow[],
  org: CardOrgInfo,
): CardSheetPage[] {
  const source = full ?? building;
  const address = text(source.address);
  const entrance = text(source.entrancePassword);
  // 건물 편집 화면과 같은 규칙으로 정규화 업체 행과 vendor_details 키를 합친다(D1).
  const vendors = mergeVendors(full?.vendorDetails?.vendors, full?.vendors ?? []);
  const cleaning = vendors.cleaning;
  const septic = vendors.septic;
  const internet = vendors.internet;
  const header: CardSheetHeader = {
    code: source.code,
    dongName: address.split(" ")[1] || "—",
    address,
    name: source.name,
    phone: org.companyPhone,
    company: org.companyName,
    keyLine: entrance ? `입구${entrance}` : "",
    memo: text(source.memo),
  };
  const blocks: CardVendorBlocks = {
    cleaning: {
      manager: org.cleaningManagerName(source.cleaningUserId),
      frequency: text(cleaning?.fields["청소 횟수"]),
      weekdays: text(cleaning?.fields["청소 요일"]),
      amount: text(cleaning?.fields["청소 금액"]),
      remarks: text(cleaning?.memo),
    },
    septic: {
      vendor: text(septic?.fields["업체명"]),
      phone: text(septic?.fields["전화번호"]),
      amount: text(septic?.fields["금액"]),
      billingType: text(septic?.fields["정화조 구분"]),
    },
    internet: {
      vendor: text(internet?.fields["업체명"]),
      holder: "",
      amount: text(internet?.fields["인터넷 금액"]),
    },
  };
  const customerNumbers = full?.customerNumbers ?? [];
  const water = numberLines(customerNumbers, "water");
  const commonElec = numberLines(customerNumbers, "common_elec");
  const units = [...rows].sort((a, b) => compareUnitNo(a.unitNo, b.unitNo)).map(unitLine);
  const chunks: CardUnitLine[][] = [];
  for (let index = 0; index < units.length; index += CARD_UNITS_PER_PAGE) {
    chunks.push(units.slice(index, index + CARD_UNITS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);
  return chunks.map((chunk, index) => ({
    key: `card-${building.id}-${index}`,
    building,
    header,
    blocks,
    water,
    commonElec,
    units: chunk,
    pageIndex: index,
    pageCount: chunks.length,
  }));
}
