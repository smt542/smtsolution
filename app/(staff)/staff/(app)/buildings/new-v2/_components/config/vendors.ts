import type { FieldDef } from "./types";

/** 미리보기용 업체명 옵션(실제 화면에서는 등록된 협력업체 마스터로 대체). */
const VENDOR_NAME_OPTIONS = ["직접 입력", "○○업체", "△△업체", "□□업체"];

/** 모든 업체 공통 선두 3필드: 업체명(선택) → 전화번호·계좌번호(선택 시 자동 채움 → readonly). */
const base = (): FieldDef[] => [
  { label: "업체명", kind: "select", placeholder: "업체 선택", options: VENDOR_NAME_OPTIONS },
  { label: "전화번호", kind: "readonly", placeholder: "전화번호" },
  { label: "계좌번호", kind: "readonly", placeholder: "계좌번호" },
];

export interface VendorDef {
  key: string;
  title: string;
  fields: FieldDef[];
}

/** ② 업체 및 담당자 지정 — 9개 업체 아코디언 (Figma 673:55789). */
export const VENDORS: VendorDef[] = [
  {
    key: "cleaning",
    title: "청소 업체",
    fields: [
      ...base(),
      { label: "청소 횟수", kind: "text", placeholder: "청소 횟수" },
      { label: "청소 요일", kind: "text", placeholder: "청소 요일" },
      { label: "청소 금액", kind: "text", placeholder: "청소 금액" },
    ],
  },
  {
    key: "septic",
    title: "정화조 업체",
    fields: [
      ...base(),
      { label: "정화조 구분", kind: "text", placeholder: "정화조 구분" },
      { label: "날짜", kind: "date" },
      { label: "금액", kind: "text", placeholder: "금액" },
      { label: "정화조 용량", kind: "text", placeholder: "정화조 용량" },
    ],
  },
  {
    key: "internet",
    title: "인터넷 업체",
    fields: [
      ...base(),
      { label: "고객번호", kind: "text", placeholder: "고객번호" },
      { label: "인터넷 전화", kind: "phone", placeholder: "인터넷 전화" },
      { label: "인터넷 금액", kind: "text", placeholder: "인터넷 금액" },
      { label: "출력", kind: "select", options: ["Y", "N"] },
      { label: "납부일", kind: "date" },
      { label: "만료일", kind: "date" },
    ],
  },
  {
    key: "elec_safety",
    title: "전기안전업체",
    fields: [
      ...base(),
      { label: "관리 금액", kind: "text", placeholder: "관리 금액" },
      { label: "안전 구분", kind: "text", placeholder: "안전 구분" },
    ],
  },
  {
    key: "cable",
    title: "유선방송정보업체",
    fields: [
      ...base(),
      { label: "납부일", kind: "date" },
      { label: "인터넷 전화", kind: "phone", placeholder: "인터넷 전화" },
      { label: "인터넷 금액", kind: "text", placeholder: "인터넷 금액" },
    ],
  },
  {
    key: "elevator_maint",
    title: "승강기보수업체",
    fields: [
      ...base(),
      { label: "승강기 금액", kind: "text", placeholder: "승강기 금액" },
      { label: "설치일", kind: "date" },
      { label: "담당자", kind: "text", placeholder: "담당자" },
      { label: "승강기 구분", kind: "text", placeholder: "승강기 구분" },
      { label: "계약일자", kind: "date" },
    ],
  },
  {
    key: "elevator_insp",
    title: "승강기정기검사업체",
    fields: [
      ...base(),
      { label: "검사일", kind: "date" },
      { label: "금액", kind: "text", placeholder: "금액" },
      { label: "안전관리", kind: "text", placeholder: "안전관리" },
      { label: "선임일", kind: "date" },
      { label: "일련번호", kind: "text", placeholder: "일련번호" },
      { label: "고유번호", kind: "text", placeholder: "고유번호" },
      { label: "운행층", kind: "text", placeholder: "운행층" },
      { label: "비상통화", kind: "text", placeholder: "비상통화" },
    ],
  },
  {
    key: "fire",
    title: "소방검사업체",
    fields: [
      ...base(),
      { label: "검사일", kind: "date" },
      { label: "금액", kind: "text", placeholder: "금액" },
      { label: "담당", kind: "text", placeholder: "담당" },
      { label: "보고일자", kind: "date" },
      { label: "선임일자", kind: "date" },
    ],
  },
  {
    key: "cctv",
    title: "CCTV 업체",
    fields: [
      ...base(),
      { label: "카메라 대수", kind: "text", placeholder: "카메라 대수" },
      { label: "녹화 보관일수", kind: "text", placeholder: "녹화 보관일수" },
      { label: "관리 금액", kind: "text", placeholder: "관리 금액" },
      { label: "담당자", kind: "text", placeholder: "담당자" },
      { label: "설치일", kind: "date" },
      { label: "계약일", kind: "date" },
    ],
  },
];
