import type { FieldDef } from "./types";

const YN = ["Y", "N"];
const MONTH = ["당월", "전월"];
const BILLING_PERIOD = ["당월", "전월", "전전월"];
const CALC = ["자동", "수동"];
const CALC_METHOD = ["기본", "인원", "시조례", "시+톤당", "시+인원", "기타"];
const TRANSFER = ["이체", "미이체"];
const METER_DAY = Array.from({ length: 31 }, (_, i) => `${i + 1}일`);

export interface UtilityDef {
  key: string;
  title: string;
  fields: FieldDef[];
}

/** ⑤ 부가 정보 — 4개 유틸 아코디언(수도/공용전기/전기/가스). 각 아코디언은 "고객번호 카드"를 갖는다. */
export const UTILITIES: UtilityDef[] = [
  {
    key: "water",
    title: "수도 정보",
    fields: [
      { label: "고객번호", kind: "text", placeholder: "고객번호 입력" },
      { label: "성명", kind: "text", placeholder: "성명 입력" },
      { label: "입금", kind: "text", placeholder: "입금 계좌 또는 금액" },
      { label: "월분", kind: "select", options: MONTH },
      { label: "계산", kind: "select", options: CALC },
      { label: "계산법", kind: "select", options: CALC_METHOD },
      { label: "이체", kind: "select", options: TRANSFER },
      { label: "조회", kind: "text", placeholder: "조회 번호 또는 코드" },
      { label: "검침일", kind: "select", options: METER_DAY },
      { label: "고지기간", kind: "select", options: BILLING_PERIOD },
      { label: "고지기간 출력", kind: "select", options: YN },
      { label: "메모", kind: "text", placeholder: "이 고객번호 관련 메모", full: true },
    ],
  },
  {
    key: "common_elec",
    title: "공용 전기정보",
    fields: [
      { label: "고객번호", kind: "text", placeholder: "고객번호 입력" },
      { label: "계약명", kind: "text", placeholder: "계약명 입력" },
      { label: "입금", kind: "text", placeholder: "입금 계좌 또는 금액" },
      { label: "월분", kind: "select", options: MONTH },
      { label: "이체", kind: "select", options: TRANSFER },
      { label: "조회", kind: "text", placeholder: "조회 번호 또는 코드" },
      { label: "검침일", kind: "select", options: METER_DAY },
      { label: "고지기간", kind: "select", options: BILLING_PERIOD },
      { label: "메모", kind: "text", placeholder: "이 고객번호 관련 메모", full: true },
    ],
  },
  {
    key: "elec",
    title: "전기 정보",
    fields: [
      { label: "고객번호", kind: "text", placeholder: "고객번호 입력" },
      { label: "계약명", kind: "text", placeholder: "계약명 입력" },
      { label: "입금", kind: "text", placeholder: "입금 계좌 또는 금액" },
      { label: "월분", kind: "select", options: MONTH },
      { label: "계산1", kind: "select", options: CALC },
      { label: "계산2", kind: "select", options: CALC_METHOD },
      { label: "이체", kind: "select", options: TRANSFER },
      { label: "조회", kind: "text", placeholder: "조회 번호 또는 코드" },
      { label: "검침일", kind: "select", options: METER_DAY },
      { label: "고지기간", kind: "select", options: BILLING_PERIOD },
      { label: "고지기간 출력", kind: "select", options: YN },
      { label: "메모", kind: "text", placeholder: "이 고객번호 관련 메모", full: true },
    ],
  },
  {
    key: "gas",
    title: "가스 정보",
    fields: [
      { label: "고객번호", kind: "text", placeholder: "고객번호 입력" },
      { label: "계약자", kind: "text", placeholder: "계약자 입력" },
      { label: "입금", kind: "text", placeholder: "입금 계좌 또는 금액" },
      { label: "월분", kind: "select", options: MONTH },
      { label: "계산1", kind: "select", options: CALC },
      { label: "계산2", kind: "select", options: CALC_METHOD },
      { label: "이체", kind: "select", options: TRANSFER },
      { label: "조회", kind: "text", placeholder: "조회 번호 또는 코드" },
      { label: "검침", kind: "select", options: METER_DAY },
      { label: "고지기간", kind: "select", options: BILLING_PERIOD },
      { label: "고지기간 출력", kind: "select", options: YN },
      { label: "메모", kind: "text", placeholder: "이 고객번호 관련 메모", full: true },
    ],
  },
];

/** 가스 아코디언 하단(고객번호 카드 밖) 공통 필드. */
export const GAS_EXTRA: FieldDef[] = [
  { label: "가스회사", kind: "text", placeholder: "가스회사" },
  { label: "가스전화", kind: "text", placeholder: "가스전화" },
  { label: "계좌번호", kind: "text", placeholder: "계좌번호" },
];
