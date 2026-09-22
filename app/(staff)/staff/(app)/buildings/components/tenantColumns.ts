import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { formatNumber } from "@/lib/format";

export interface TenantColumn {
  key: string;
  label: string;
  /** Cell text from the list row. Returns "" for fields not yet wired (후속 배선). */
  get: (t: TenantListRow) => string;
}

const empty = () => "";
const ynLabel = (value: boolean | null | undefined) => value == null ? "" : value ? "Y" : "N";
const oxLabel = (value: boolean | null | undefined) => value == null ? "" : value ? "O" : "X";
const consentLabel = (value: boolean | null | undefined) => value == null ? "" : value ? "동의" : "거부";
const displayDate = (value: string | null | undefined) => value?.slice(0, 10).replaceAll("-", ".") ?? "";
const dateOrDash = (value: string | null | undefined) => displayDate(value) || "—";
const unitNoLabel = (value: string | null | undefined) => value?.replace(/\s*호$/, "") ?? "";
const areaLabel = (value: number | null | undefined) => {
  const formatted = formatNumber(value, { nullText: "" });
  return formatted ? `${formatted}평` : "";
};
const meterLabel = (customerNo: string | null | undefined, meterNo: string | null | undefined) =>
  [customerNo, meterNo].filter(Boolean).join(" · ");
const BILL_NAME_LABELS: Record<string, string> = { none: "이름 미출력", name: "이름 출력", code: "코드번호 출력" };
const TRANSFER_LABELS: Record<string, string> = {
  giro: "지로", transfer: "이체", auto_transfer: "자동이체", deposit: "입금", none: "없음",
};
const DELIVERY_LABELS: Record<string, string> = { post: "우편", alimtalk: "알림톡" };
const enumLabel = (value: string | null | undefined, labels: Record<string, string>) => value ? (labels[value] ?? value) : "";

/**
 * prototype building-list 입주민 표 — 32 컬럼(가로 스크롤).
 *
 * 원천 필드가 없는 홈피 비번만 보안상 빈 셀로 유지한다. 비밀번호를 전체 세대 목록에
 * 노출하지 않고, 상세 화면에서만 확인할 수 있도록 한다.
 */
export const TENANT_COLUMNS: TenantColumn[] = [
  { key: "unitNo", label: "호실", get: (t) => unitNoLabel(t.unitNo) },
  { key: "tenantName", label: "입주자명", get: (t) => (t.isVacant ? "공실" : (t.tenantName ?? "-")) },
  { key: "payerName", label: "입금자명", get: (t) => t.payerName ?? "" },
  { key: "roomType", label: "룸", get: (t) => t.roomTypeLabel ?? "" },
  { key: "residentCount", label: "인원", get: (t) => (t.residentCount != null ? `${t.residentCount}명` : "") },
  { key: "phone", label: "전화번호", get: (t) => t.phone ?? "" },
  { key: "vehicleNo", label: "차량번호", get: (t) => t.vehicleNo ?? "" },
  { key: "moveInDate", label: "입주일", get: (t) => displayDate(t.moveInDate) },
  { key: "managementFee", label: "관리비", get: (t) => formatNumber(t.mgmtFeeAmount, { nullText: "" }) },
  { key: "moveOutDate", label: "퇴실일자", get: (t) => dateOrDash(t.moveOutDate) },
  { key: "moveInScheduled", label: "입주예정일", get: (t) => dateOrDash(t.expectedMoveInDate) },
  { key: "increaseAmount", label: "인상액", get: (t) => formatNumber(t.increaseAmount, { nullText: "" }) },
  { key: "areaPyeong", label: "평형", get: (t) => areaLabel(t.areaPyeong) },
  { key: "water", label: "수도", get: (t) => meterLabel(t.waterCustomerNo, t.waterMeterNo) },
  { key: "electricity", label: "전기", get: (t) => meterLabel(t.elecCustomerNo, t.elecMeterNo) },
  { key: "commonElectricity", label: "공용 전기", get: (t) => meterLabel(t.commonElecCustomerNo, t.commonElecMeterNo) || (t.commonElecNo ?? "") },
  { key: "gas", label: "가스", get: (t) => meterLabel(t.gasCustomerNo, t.gasMeterNo) },
  { key: "billingEnabled", label: "부과금 여부", get: (t) => ynLabel(t.billingEnabled) },
  { key: "printEnabled", label: "고지서 출력 여부", get: (t) => ynLabel(t.printEnabled) },
  { key: "billNameDisplay", label: "고지서 이름 출력 유형", get: (t) => enumLabel(t.billNameDisplay, BILL_NAME_LABELS) },
  { key: "lateFeeEnabled", label: "연체료 부과 여부", get: (t) => oxLabel(t.lateFeeEnabled) },
  { key: "singlePrint", label: "단수 출력 여부", get: (t) => oxLabel(t.singlePrint) },
  { key: "transferMethod", label: "이체 방식", get: (t) => enumLabel(t.transferMethod, TRANSFER_LABELS) },
  { key: "smsOptIn", label: "문자 수신", get: (t) => consentLabel(t.smsOptIn) },
  { key: "billingNote", label: "적요", get: (t) => t.billingNote ?? "" },
  { key: "billAuth", label: "인증", get: (t) => consentLabel(t.billAuth) },
  { key: "homepagePw", label: "홈피 비번", get: empty },
  { key: "billDelivery", label: "발송", get: (t) => enumLabel(t.billDelivery, DELIVERY_LABELS) },
  { key: "kepcoCustomerNo", label: "한전고객번호", get: (t) => t.kepcoCustomerNo ?? "" },
  { key: "kepcoMeterNo", label: "한전계기번호", get: (t) => t.kepcoMeterNo ?? "" },
  { key: "billingDay", label: "부과일", get: (t) => t.billingDay ?? "" },
  { key: "createdAt", label: "등록일", get: (t) => displayDate(t.createdAt) },
];
