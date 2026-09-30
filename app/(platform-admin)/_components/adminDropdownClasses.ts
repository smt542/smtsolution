// 정본 .ac-dd-btn: 42px 폼 필드 트리거
export const ADMIN_FORM_DROPDOWN_CLASS = [
  "[&_.uc-dd]:w-full",
  "[&_.uc-dd-btn]:h-[42px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between",
  "[&_.uc-dd-btn]:rounded-[10px] [&_.uc-dd-btn]:px-[13px]",
  "[&_.uc-dd-btn]:tracking-normal [&_.uc-dd-btn]:hover:border-line [&_.uc-dd-btn]:hover:shadow-none",
  "[&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-semibold",
  "[&_.uc-dd-btn_svg]:h-[14px] [&_.uc-dd-btn_svg]:w-[14px]",
  "[&_.uc-dd.open_.uc-dd-btn]:border-line [&_.uc-dd.open_.uc-dd-btn]:shadow-none",
].join(" ");

// 정본 .hq-dd-btn: 36px 발송 비용 툴바 트리거
export const ADMIN_TOOLBAR_DROPDOWN_CLASS = [
  "[&_.uc-dd-btn]:h-[36px]",
  "[&_.uc-dd-btn]:rounded-[11px]",
  "[&_.uc-dd-btn]:px-[12px]",
  "[&_.uc-dd-btn]:gap-[8px]",
  "[&_.uc-dd-btn]:text-[13.5px] [&_.uc-dd-btn]:font-bold",
  "[&_.uc-dd-btn]:tracking-normal",
  "[&_.uc-dd-btn]:hover:border-line",
  "[&_.uc-dd-btn]:hover:bg-bg",
  "[&_.uc-dd-btn]:hover:shadow-none",
  "[&_.uc-dd.open_.uc-dd-btn]:border-line",
  "[&_.uc-dd.open_.uc-dd-btn]:shadow-none",
  "[&_.uc-dd-btn_svg]:h-[14px] [&_.uc-dd-btn_svg]:w-[14px] [&_.uc-dd-btn_svg]:text-t3",
].join(" ");

// 정본 .ac-dd-menu·.hq-dd-menu와 .ac-opt·.hq-opt: 통합관리자 메뉴와 옵션(체크 → 라벨 순). menuClassName으로 준다.
export const ADMIN_DROPDOWN_MENU_CLASS = [
  "[&.uc-dd-menu]:rounded-[12px]",
  "[&.uc-dd-menu]:p-[6px]",
  "[&.uc-dd-menu]:shadow-[0_18px_40px_-12px_rgba(23,31,40,0.28)]",
  "[&_.uc-opt]:flex-row-reverse [&_.uc-opt]:justify-end [&_.uc-opt]:gap-[8px]",
  "[&_.uc-opt]:rounded-[9px] [&_.uc-opt]:px-[11px] [&_.uc-opt]:py-[9px]",
  "[&_.uc-opt]:text-[13.5px] [&_.uc-opt]:font-semibold [&_.uc-opt]:text-t2",
  "[&_.uc-opt.on]:bg-blue-t [&_.uc-opt.on]:font-bold [&_.uc-opt.on]:text-blue-d",
  "[&_.uc-opt:not(.on):hover]:bg-bg",
  "[&_.uc-opt_svg]:h-[15px] [&_.uc-opt_svg]:w-[15px]",
].join(" ");
