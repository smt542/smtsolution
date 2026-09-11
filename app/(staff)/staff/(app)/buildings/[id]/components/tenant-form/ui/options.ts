// 입주자 등록 폼 공용 셀렉트 옵션 (프로토타입 tenant-detail 정합)
export type Opt = { value: string; label: string };

// 부과금·고지서 출력 여부 (원본: Y / N, 기본 Y)
export const ynOptions: Opt[] = [
  { value: "Y", label: "Y" },
  { value: "N", label: "N" },
];
// 연체료·단수 출력 여부 (원본: X / O, 기본 X) — 값 의미는 Y=on/N=off로 동일
export const oxOptions: Opt[] = [
  { value: "N", label: "X" },
  { value: "Y", label: "O" },
];
// 수신 동의/거부
export const agreeOptions: Opt[] = [
  { value: "agree", label: "동의" },
  { value: "deny", label: "거부" },
];
// 이체 방식 (원본: 지로 / 이체 / 자동이체 / 입금 / 없음)
export const transferMethodOptions: Opt[] = [
  { value: "giro", label: "지로" },
  { value: "transfer", label: "이체" },
  { value: "auto_transfer", label: "자동이체" },
  { value: "deposit", label: "입금" },
  { value: "none", label: "없음" },
];
// 고지서 이름 출력 유형 (원본: 이름 미출력 / 이름 출력 / 코드번호 출력)
export const billNameDisplayOptions: Opt[] = [
  { value: "none", label: "이름 미출력" },
  { value: "name", label: "이름 출력" },
  { value: "code", label: "코드번호 출력" },
];
// 고지서 발송 (원본 순서: 알림톡 고지서 / 우편)
export const billDeliveryOptions: Opt[] = [
  { value: "alimtalk", label: "알림톡 고지서" },
  { value: "post", label: "우편" },
];
// 할인 유형 (원본: 일반 / 수급자할인 / 다자녀할인 / 기타할인, 기본 일반)
export const discountTypeOptions: Opt[] = [
  { value: "general", label: "일반" },
  { value: "recipient", label: "수급자할인" },
  { value: "multichild", label: "다자녀할인" },
  { value: "etc", label: "기타할인" },
];
// 임대구분 (원본: 월세 / 전세 / 협의가능, 기본 월세)
export const leaseTypeOptions: Opt[] = [
  { value: "month", label: "월세" },
  { value: "jeonse", label: "전세" },
  { value: "negotiable", label: "협의가능" },
];
// 부동산 물건구분 (원본: 원룸 / 1.5룸 / 투룸 / 쓰리룸 / 기타, 기본 원룸)
export const propertyTypeOptions: Opt[] = [
  { value: "oneroom", label: "원룸" },
  { value: "oneandhalf", label: "1.5룸" },
  { value: "tworoom", label: "투룸" },
  { value: "threeroom", label: "쓰리룸" },
  { value: "etc", label: "기타" },
];
// 부동산 거래형태 (원본: 직거래 / 중개거래, 기본 직거래)
export const dealTypeOptions: Opt[] = [
  { value: "direct", label: "직거래" },
  { value: "agency", label: "중개거래" },
];
// 부동산 구분 (원본: 월세 / 전세 / 전·월세, 기본 월세)
export const propertyClassOptions: Opt[] = [
  { value: "month", label: "월세" },
  { value: "jeonse", label: "전세" },
  { value: "month_jeonse", label: "전·월세" },
];
