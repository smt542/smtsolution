/**
 * 현장 앱 정본 `.dd-btn` — 드롭다운(PartnerDropdown)과 날짜(PartnerDateSheet) 트리거가 같은 규격을 쓴다.
 * 테두리 색은 넣지 않는다: 드롭다운은 열리면 청록으로 바뀌어서, 같은 속성 유틸이 둘 붙으면
 * class 순서가 아니라 CSS 생성 순서가 이긴다. 테두리 색은 각 컴포넌트가 상태마다 하나만 붙인다.
 * 줄높이는 정본 `font:inherit`(= normal). 앱은 preflight 1.5를 상속한다.
 *
 * look
 * - `as`: mobile-as·mobile-as-new `.dd-btn` — 44px·15px/700
 * - `settlement`: mobile-ms-new 행·카드 안 `.row .dd-btn`·`.ucard .dd-btn`·`.fld>.dd-btn` — 48px·16px/600
 */
export type PartnerFieldLook = "as" | "settlement";

const BASE =
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-[12px] border bg-white px-[13px] text-left leading-[normal] text-t1 disabled:cursor-default disabled:opacity-70";

export const PARTNER_FIELD_TRIGGER: Record<PartnerFieldLook, string> = {
  as: `${BASE} h-11 text-[15px] font-bold`,
  settlement: `${BASE} h-12 text-[16px] font-semibold`,
};
