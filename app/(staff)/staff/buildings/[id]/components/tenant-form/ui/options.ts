// 입주자 등록 폼 공용 셀렉트 옵션 (Figma 673-58897)
export type Opt = { value: string; label: string };

// 불리언 Y/X (Figma: 부과금 여부 Y, 연체료·단수 X)
export const ynOptions: Opt[] = [
  { value: "Y", label: "Y" },
  { value: "N", label: "X" },
];
// 수신 동의/거부
export const agreeOptions: Opt[] = [
  { value: "agree", label: "동의" },
  { value: "deny", label: "거부" },
];
// 이체 방식
export const transferMethodOptions: Opt[] = [
  { value: "giro", label: "지로" },
  { value: "transfer", label: "계좌이체" },
  { value: "auto_transfer", label: "자동이체" },
  { value: "deposit", label: "무통장입금" },
  { value: "none", label: "없음" },
];
// 고지서 이름 출력 유형
export const billNameDisplayOptions: Opt[] = [
  { value: "none", label: "이름 미출력" },
  { value: "name", label: "이름 출력" },
  { value: "code", label: "코드 출력" },
];
// 고지서 발송
export const billDeliveryOptions: Opt[] = [
  { value: "post", label: "우편 고지서" },
  { value: "alimtalk", label: "알림톡 고지서" },
];
// 할인 유형 (값 집합 운영 확정 전 — PRD 미정)
export const discountTypeOptions: Opt[] = [
  { value: "general", label: "일반" },
  { value: "basic_living", label: "기초수급" },
  { value: "veteran", label: "국가유공자" },
  { value: "disabled", label: "장애인" },
  { value: "etc", label: "기타" },
];
// 임대구분 / 부동산 구분 (월세·전세·매매)
export const rentTypeOptions: Opt[] = [
  { value: "month", label: "월세" },
  { value: "jeonse", label: "전세" },
  { value: "sale", label: "매매" },
];
// 부동산 물건구분
export const propertyTypeOptions: Opt[] = [
  { value: "oneroom", label: "원룸" },
  { value: "tworoom", label: "투룸" },
  { value: "officetel", label: "오피스텔" },
  { value: "apartment", label: "아파트" },
  { value: "villa", label: "빌라" },
  { value: "etc", label: "기타" },
];
// 부동산 거래형태
export const dealTypeOptions: Opt[] = [
  { value: "direct", label: "직거래" },
  { value: "agency", label: "중개" },
];
