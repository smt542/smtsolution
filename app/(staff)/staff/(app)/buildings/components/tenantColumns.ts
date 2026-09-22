import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { formatNumber } from "@/lib/format";

export interface TenantColumn {
  key: string;
  label: string;
  /** Cell text from the list row. Returns "" for fields not yet wired (후속 배선). */
  get: (t: TenantListRow) => string;
}

const empty = () => "";
const booleanLabel = (value: boolean | null | undefined) => value == null ? "" : value ? "예" : "아니오";
const datePart = (value: string | null | undefined) => value?.slice(0, 10) ?? "";

/**
 * prototype building-list 입주민 표 — 32 컬럼(가로 스크롤).
 *
 * 데이터 원본이 아직 없는 네 컬럼은 빈 셀로 표시한다:
 *   입주예정일·인상액·홈피 비번·부과일.
 */
export const TENANT_COLUMNS: TenantColumn[] = [
  { key: "unitNo", label: "호실", get: (t) => t.unitNo ?? "" },
  { key: "tenantName", label: "입주자명", get: (t) => (t.isVacant ? "공실" : (t.tenantName ?? "-")) },
  { key: "payerName", label: "입금자명", get: (t) => t.payerName ?? "" },
  { key: "roomType", label: "룸", get: (t) => t.roomTypeLabel ?? "" },
  { key: "residentCount", label: "인원", get: (t) => (t.residentCount != null ? `${t.residentCount}명` : "") },
  { key: "phone", label: "전화번호", get: (t) => t.phone ?? "" },
  { key: "vehicleNo", label: "차량번호", get: (t) => t.vehicleNo ?? "" },
  { key: "moveInDate", label: "입주일", get: (t) => t.moveInDate ?? "" },
  { key: "managementFee", label: "관리비", get: (t) => formatNumber(t.mgmtFeeAmount, { nullText: "" }) },
  { key: "moveOutDate", label: "퇴실일자", get: (t) => datePart(t.moveOutDate) },
  { key: "moveInScheduled", label: "입주예정일", get: empty },
  { key: "increaseAmount", label: "인상액", get: empty },
  { key: "areaPyeong", label: "평형", get: (t) => t.areaPyeong == null ? "" : String(t.areaPyeong) },
  { key: "water", label: "수도", get: (t) => t.waterAccount ?? "" },
  { key: "electricity", label: "전기", get: (t) => t.elecAccount ?? "" },
  { key: "commonElectricity", label: "공용 전기", get: (t) => t.commonElecNo ?? "" },
  { key: "gas", label: "가스", get: (t) => t.gasAccount ?? "" },
  { key: "billingEnabled", label: "부과금 여부", get: (t) => booleanLabel(t.billingEnabled) },
  { key: "printEnabled", label: "고지서 출력 여부", get: (t) => booleanLabel(t.printEnabled) },
  { key: "billNameDisplay", label: "고지서 이름 출력 유형", get: (t) => t.billNameDisplay ?? "" },
  { key: "lateFeeEnabled", label: "연체료 부과 여부", get: (t) => booleanLabel(t.lateFeeEnabled) },
  { key: "singlePrint", label: "단수 출력 여부", get: (t) => booleanLabel(t.singlePrint) },
  { key: "transferMethod", label: "이체 방식", get: (t) => t.transferMethod ?? "" },
  { key: "smsOptIn", label: "문자 수신", get: (t) => booleanLabel(t.smsOptIn) },
  { key: "billingNote", label: "적요", get: (t) => t.billingNote ?? "" },
  { key: "billAuth", label: "인증", get: (t) => booleanLabel(t.billAuth) },
  { key: "homepagePw", label: "홈피 비번", get: empty },
  { key: "billDelivery", label: "발송", get: (t) => t.billDelivery ?? "" },
  { key: "kepcoCustomerNo", label: "한전고객번호", get: (t) => t.kepcoCustomerNo ?? "" },
  { key: "kepcoMeterNo", label: "한전계기번호", get: (t) => t.kepcoMeterNo ?? "" },
  { key: "billingDay", label: "부과일", get: empty },
  { key: "createdAt", label: "등록일", get: (t) => datePart(t.createdAt) },
];
