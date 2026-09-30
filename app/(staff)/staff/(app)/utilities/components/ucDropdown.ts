/**
 * 공과금 정본 `.uc-dd`(utility-electric|water|gas.dc.html) 값이 공용 CustomDropdown 기본값과 다른 곳을 덮는다.
 * 버튼 hover 는 테두리만(#C9D0D8, 청록 링 없음)·메뉴 패딩 5·옵션 간격 10·옵션 hover #F5F7F9.
 * 화살표 회전·청록과 메뉴 페이드는 CustomDropdown chevron="accent"·menuTransition 이 맡는다.
 */
export const UC_DROPDOWN_CLASS = [
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:border-[#C9D0D8]",
  "[&_.uc-dd:not(.open)_.uc-dd-btn:hover]:shadow-none",
  "[&_.uc-dd-menu]:p-[5px]",
  "[&_.uc-opt]:gap-[10px]",
  "[&_.uc-opt:not(.on):hover]:bg-[#F5F7F9]",
].join(" ");
