import type { TenantListRow } from "@/hooks/reactquery/occupancies";
import { formatNumber } from "@/lib/format";

export interface TenantColumn {
  key: string;
  label: string;
  minWidth: number;
  /** 목록 행과 건물 고객번호 문맥에서 셀 텍스트를 만든다. 홈피 비번은 보안상 빈 셀이다. */
  get: (t: TenantListRow, ctx: TenantColumnContext) => string;
}

export interface TenantColumnContext {
  customerLabel: (
    kind: "water" | "elec" | "common_elec" | "gas",
    customerNo: string | null | undefined,
  ) => string;
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
const BILL_NAME_LABELS: Record<string, string> = { none: "이름 미출력", name: "이름 출력", code: "코드번호 출력" };
const TRANSFER_LABELS: Record<string, string> = {
  giro: "지로", transfer: "이체", auto_transfer: "자동이체", deposit: "입금", none: "없음",
};
const DELIVERY_LABELS: Record<string, string> = { post: "우편", alimtalk: "알림톡" };
const enumLabel = (value: string | null | undefined, labels: Record<string, string>) => value ? (labels[value] ?? value) : "";

/**
 * prototype building-list 입주민 표 — 32 컬럼(가로 스크롤).
 *
 * 수도·전기·공용 전기·가스는 건물 고객번호 순번 문맥을 받아 표시한다. 원천 필드가 없는
 * 홈피 비번만 보안상 빈 셀로 유지하고, 비밀번호는 전체 세대 목록에 노출하지 않는다.
 */
export const TENANT_COLUMNS: TenantColumn[] = [
  { key: "unitNo", label: "호실", minWidth: 56.89, get: (t) => unitNoLabel(t.unitNo) },
  { key: "tenantName", label: "입주자명", minWidth: 73.48, get: (t) => (t.isVacant ? "" : (t.tenantName ?? "")) },
  { key: "payerName", label: "입금자명", minWidth: 73.48, get: (t) => t.payerName ?? "" },
  { key: "roomType", label: "룸", minWidth: 67.02, get: (t) => t.roomTypeLabel ?? "" },
  { key: "residentCount", label: "인원", minWidth: 52.75, get: (t) => (t.residentCount != null ? `${t.residentCount}명` : "") },
  { key: "phone", label: "전화번호", minWidth: 148.11, get: (t) => t.phone ?? "" },
  { key: "vehicleNo", label: "차량번호", minWidth: 111.59, get: (t) => t.vehicleNo ?? "" },
  { key: "moveInDate", label: "입주일", minWidth: 102.58, get: (t) => displayDate(t.moveInDate) },
  { key: "managementFee", label: "관리비", minWidth: 81.33, get: (t) => formatNumber(t.mgmtFeeAmount, { nullText: "" }) },
  { key: "moveOutDate", label: "퇴실일자", minWidth: 102.44, get: (t) => dateOrDash(t.moveOutDate) },
  { key: "moveInScheduled", label: "입주예정일", minWidth: 102.13, get: (t) => dateOrDash(t.expectedMoveInDate) },
  { key: "increaseAmount", label: "인상액", minWidth: 66.98, get: (t) => formatNumber(t.increaseAmount, { nullText: "" }) },
  { key: "areaPyeong", label: "평형", minWidth: 59.81, get: (t) => areaLabel(t.areaPyeong) },
  { key: "water", label: "수도", minWidth: 130.19, get: (t, ctx) => ctx.customerLabel("water", t.waterCustomerNo) },
  { key: "electricity", label: "전기", minWidth: 128.42, get: (t, ctx) => ctx.customerLabel("elec", t.elecCustomerNo) },
  {
    key: "commonElectricity",
    label: "공용 전기",
    minWidth: 126.47,
    get: (t, ctx) => ctx.customerLabel("common_elec", t.commonElecCustomerNo || t.commonElecNo),
  },
  { key: "gas", label: "가스", minWidth: 130.61, get: (t, ctx) => ctx.customerLabel("gas", t.gasCustomerNo) },
  { key: "billingEnabled", label: "부과금 여부", minWidth: 86.63, get: (t) => ynLabel(t.billingEnabled ?? (t.isVacant ? false : null)) },
  { key: "printEnabled", label: "고지서 출력 여부", minWidth: 110.14, get: (t) => ynLabel(t.printEnabled) },
  { key: "billNameDisplay", label: "고지서 이름 출력 유형", minWidth: 133.64, get: (t) => enumLabel(t.billNameDisplay, BILL_NAME_LABELS) },
  { key: "lateFeeEnabled", label: "연체료 부과 여부", minWidth: 110.14, get: (t) => oxLabel(t.lateFeeEnabled) },
  { key: "singlePrint", label: "단수 출력 여부", minWidth: 99.77, get: (t) => oxLabel(t.singlePrint) },
  { key: "transferMethod", label: "이체 방식", minWidth: 76.25, get: (t) => enumLabel(t.transferMethod, TRANSFER_LABELS) },
  { key: "smsOptIn", label: "문자 수신", minWidth: 76.25, get: (t) => consentLabel(t.smsOptIn) },
  { key: "billingNote", label: "적요", minWidth: 105.41, get: (t) => t.billingNote ?? "" },
  { key: "billAuth", label: "인증", minWidth: 52.75, get: (t) => consentLabel(t.billAuth) },
  { key: "homepagePw", label: "홈피 비번", minWidth: 76.25, get: empty },
  { key: "billDelivery", label: "발송", minWidth: 52.75, get: (t) => enumLabel(t.billDelivery, DELIVERY_LABELS) },
  { key: "kepcoCustomerNo", label: "한전고객번호", minWidth: 94.23, get: (t) => t.kepcoCustomerNo ?? "" },
  { key: "kepcoMeterNo", label: "한전계기번호", minWidth: 94.23, get: (t) => t.kepcoMeterNo ?? "" },
  { key: "billingDay", label: "부과일", minWidth: 63.13, get: (t) => t.billingDay ?? "" },
  { key: "createdAt", label: "등록일", minWidth: 102.58, get: (t) => displayDate(t.createdAt) },
];
