import type { TenantListRow } from "@/hooks/reactquery/occupancies";

export interface TenantColumn {
  key: string;
  label: string;
  /** Minimum column width in px — drives the table's horizontal scroll width. */
  w: number;
  /** Cell text from the list row. Returns "" for fields not yet wired (후속 배선). */
  get: (t: TenantListRow) => string;
}

const empty = () => "";
const booleanLabel = (value: boolean | null | undefined) => value == null ? "" : value ? "예" : "아니오";
const datePart = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

/**
 * Figma 673:40619 입주민 표 — 33 컬럼(가로 스크롤).
 *
 * 데이터 원본이 아직 없는 다섯 컬럼은 빈 셀로 표시한다:
 *   이사청소·인상액·입주예정일·홈피 비번·부과일.
 */
export const TENANT_COLUMNS: TenantColumn[] = [
  { key: "unitNo", label: "호실", w: 72, get: (t) => t.unitNo ?? "" },
  { key: "tenantName", label: "입주자명", w: 92, get: (t) => (t.isVacant ? "공실" : (t.tenantName ?? "-")) },
  { key: "payerName", label: "입금자명", w: 92, get: (t) => t.payerName ?? "" },
  { key: "roomType", label: "룸", w: 68, get: (t) => t.roomTypeLabel ?? "" },
  { key: "residentCount", label: "인원", w: 62, get: (t) => (t.residentCount != null ? `${t.residentCount}명` : "") },
  { key: "phone", label: "전화번호", w: 132, get: (t) => t.phone ?? "" },
  { key: "vehicleNo", label: "차량번호", w: 104, get: (t) => t.vehicleNo ?? "" },
  { key: "moveInDate", label: "입주일", w: 104, get: (t) => t.moveInDate ?? "" },
  { key: "managementFee", label: "관리비", w: 92, get: (t) => t.mgmtAccount ?? "" },
  { key: "moveCleaning", label: "이사청소", w: 84, get: empty },
  { key: "increaseAmount", label: "인상액", w: 84, get: empty },
  { key: "areaPyeong", label: "평형", w: 72, get: (t) => t.areaPyeong == null ? "" : String(t.areaPyeong) },
  { key: "water", label: "수도", w: 120, get: (t) => t.waterAccount ?? "" },
  { key: "electricity", label: "전기", w: 120, get: (t) => t.elecAccount ?? "" },
  { key: "commonElectricity", label: "공용 전기", w: 120, get: (t) => t.commonElecNo ?? "" },
  { key: "gas", label: "가스", w: 120, get: (t) => t.gasAccount ?? "" },
  { key: "billingEnabled", label: "부과금 여부", w: 96, get: (t) => booleanLabel(t.billingEnabled) },
  { key: "printEnabled", label: "고지서 출력 여부", w: 118, get: (t) => booleanLabel(t.printEnabled) },
  { key: "billNameDisplay", label: "고지서 이름 출력 유형", w: 140, get: (t) => t.billNameDisplay ?? "" },
  { key: "moveOutDate", label: "퇴실일자", w: 104, get: (t) => datePart(t.moveOutDate) },
  { key: "moveInScheduled", label: "입주예정일", w: 104, get: empty },
  { key: "lateFeeEnabled", label: "연체료 부과 여부", w: 120, get: (t) => booleanLabel(t.lateFeeEnabled) },
  { key: "singlePrint", label: "단수 출력 여부", w: 108, get: (t) => booleanLabel(t.singlePrint) },
  { key: "transferMethod", label: "이체 방식", w: 92, get: (t) => t.transferMethod ?? "" },
  { key: "smsOptIn", label: "문자 수신", w: 84, get: (t) => booleanLabel(t.smsOptIn) },
  { key: "billingNote", label: "적요", w: 92, get: (t) => t.billingNote ?? "" },
  { key: "billAuth", label: "인증", w: 70, get: (t) => booleanLabel(t.billAuth) },
  { key: "homepagePw", label: "홈피 비번", w: 92, get: empty },
  { key: "billDelivery", label: "발송", w: 72, get: (t) => t.billDelivery ?? "" },
  { key: "kepcoCustomerNo", label: "한전고객번호", w: 112, get: (t) => t.kepcoCustomerNo ?? "" },
  { key: "kepcoMeterNo", label: "한전계기번호", w: 112, get: (t) => t.kepcoMeterNo ?? "" },
  { key: "billingDay", label: "부과일", w: 92, get: empty },
  { key: "createdAt", label: "등록일", w: 104, get: (t) => datePart(t.createdAt) },
];

/** Sum of column widths → min-width for the horizontally scrollable tenant table. */
export const TENANT_TABLE_MIN_WIDTH = TENANT_COLUMNS.reduce((sum, c) => sum + c.w, 0);
