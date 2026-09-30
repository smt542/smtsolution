"use client";

import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "@/components/icons";

export interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  /** 트리거 버튼 id. 폼의 `<label htmlFor>`가 드롭다운을 가리키게 할 때 준다. */
  id?: string;
  ariaLabel: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /**
   * `cell` = 정본 표 셀 편집 드롭다운(`.hc-dd`·`.tc-dd .uc-dd-btn{height:26px;padding:0 8px;font-size:12px;font-weight:400}`).
   * 칸 폭을 채우고(`w-full`), 좁으면 라벨이 말줄임된다.
   * `modal` = 정본 모달 폼 드롭다운 `.fmpc .mf-dd`(항목등록·협력업체): 44px·13.5px/700·padding 0 11px·gap 8,
   * hover 효과 없음·열림은 테두리만 청록, 화살표 13px 회색이 열리면 뒤집힌다. 메뉴는 `.dd-menu`·`.dd-opt` 규격.
   */
  size?: "default" | "compact" | "notification" | "cell" | "form" | "modal";
  /** 메뉴 최소 폭(px). 정본 표 셀 드롭다운은 인라인 `min-width:112px`(수납 이력)·`96px`(입주자정보)을 준다. */
  menuMinWidth?: number;
  compact?: boolean;
  /**
   * "menu"(기본): 툴바/레일용. 메뉴가 내용 너비로 우측 정렬되고 선택 항목에 체크표시.
   * "field": 폼 필드용. 메뉴 너비를 버튼(트리거) 너비에 맞추고 체크표시를 숨긴다.
   */
  variant?: "menu" | "field";
  /**
   * "absolute"(기본): 트리거 기준 absolute 배치.
   * "fixed": 정본 `.rg-dd .ac-dd-menu{position:fixed;z-index:1000}`. 모달 본문처럼
   * `overflow:auto` 인 조상 안에 있을 때 필요하다 — absolute 로 두면 메뉴가 스크롤
   * 컨테이너를 늘려 모달에 스크롤바가 생기거나 `overflow:hidden` 에 잘린다.
   */
  position?: "absolute" | "fixed";
  /** fixed 메뉴의 정렬. `start`는 트리거 왼쪽, `end`는 트리거 오른쪽 끝에 맞춘다. */
  menuAlign?: "start" | "end";
  /**
   * 메뉴 쪽 덮어쓰기. fixed 메뉴는 body 포탈이라 호출부 래퍼의 `[&_.uc-dd-menu]`·`[&_.uc-opt]` 덮어쓰기가
   * 닿지 않는다. 같은 명시도의 기본 유틸을 이기도록 메뉴 자신은 `[&.uc-dd-menu]:…`, 옵션은 `[&_.uc-opt]:…`로 쓴다.
   */
  menuClassName?: string;
  /** 트리거에 선택 항목 대신 늘 보일 고정 라벨. 정본 메신저 `.fmp-tplsel`처럼 골라도 '템플릿'으로 남는 트리거에 쓴다. */
  triggerLabel?: string;
  /**
   * 값이 어떤 옵션과도 맞지 않을 때 버튼에 보일 미선택 라벨. 정본 `#ovYear`/`#ovMonth`
   * 처럼 초기 상태가 "년도"·"월" 인 드롭다운에 쓴다. 메뉴 항목으로는 나오지 않는다.
   * 주지 않으면 기존대로 첫 옵션 라벨로 대체한다.
   */
  placeholder?: string;
  /**
   * 선택 항목의 체크표시. 기본 "selected" — 정본에 `.uc-opt.on svg{opacity:1}` 이 있는
   * 화면용(receipt-management·moving-settlement 등).
   * "never" 는 그 규칙이 없는 정본용(공과금 이사조회 moving-gas·moving-elec·moving-water):
   * 정본은 `.uc-opt svg{opacity:0}` 만 두고 되살리지 않아 체크가 끝까지 보이지 않는다.
   * svg 자체는 남긴다 — `.uc-opt` 가 space-between + gap:10px 이라 지우면 항목이 24px 좁아진다.
   */
  check?: "selected" | "never";
}

export function CustomDropdown({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  size = "default",
  compact = false,
  variant = "menu",
  position = "absolute",
  menuAlign = "start",
  placeholder,
  check = "selected",
  menuMinWidth,
  menuClassName,
  triggerLabel,
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isFixed = position === "fixed";
  const matched = options.find((option) => option.value === value);
  const selected = matched ?? (placeholder === undefined ? options[0] : undefined);
  const isCompact = size === "compact" || compact;
  const isNotification = size === "notification";
  const isCell = size === "cell";
  const isForm = size === "form";
  const isModal = size === "modal";
  const isField = variant === "field";
  // 정본 `.as-dd .uc-dd-btn`: 폼 드롭다운은 38px/100%/14px 아이콘 규격이다.
  const triggerSize = isModal
    ? `h-11 w-full min-w-0 justify-between gap-2 rounded-[9px] px-[11px] text-[13.5px] [&_svg]:h-[13px] [&_svg]:w-[13px] [&_svg]:flex-none [&_svg]:text-t3 [&_svg]:transition-transform [&_svg]:duration-150 [&_svg]:ease-[ease] ${open ? "[&_svg]:rotate-180" : ""}`
    : isForm
    ? `h-[38px] w-full min-w-0 justify-between rounded-[9px] pl-[11px] pr-[10px] text-[13px] [&_svg]:h-[14px] [&_svg]:w-[14px] [&_svg]:flex-none [&_svg]:transition-transform [&_svg]:duration-[160ms] ${open ? "[&_svg]:rotate-180 [&_svg]:text-blue" : "[&_svg]:text-t3"}`
    : isCell
      ? "h-[26px] w-full min-w-0 justify-between rounded-[9px] px-[8px] text-[12px] [&_svg]:h-[14px] [&_svg]:w-[14px] [&_svg]:flex-none"
      : isNotification
        ? "h-[34px] w-[64px] min-w-[64px] justify-between rounded-[9px] px-[10px] text-[13.5px] [&_svg]:h-[13px] [&_svg]:w-[13px]"
        : `${isCompact ? "h-8" : "h-9"} rounded-[9px] pr-[10px] pl-[11px] text-[13px] [&_svg]:h-[15px] [&_svg]:w-[15px]`;
  // 굵기·hover 도 크기마다 하나만 둔다(같은 속성 유틸이 둘 남으면 CSS 생성 순서가 이긴다).
  // 정본 셀 드롭다운은 400 이고 hover 는 `.uc-dd-btn:hover{border-color:#C9D0D8}` 뿐이다.
  const triggerLook = isModal
    ? "font-bold"
    : isCell || isForm
      ? "font-normal hover:border-[#C9D0D8]"
      : "font-bold hover:border-blue hover:shadow-[0_0_0_3px_var(--color-blue-t)]";

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // fixed 메뉴는 body 포탈이라 rootRef 바깥이다. 메뉴 자신의 mousedown 을 바깥으로 치면
      // 항목 click 이 닿기 전에 언마운트돼 선택이 먹지 않는다.
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    // 열린 메뉴의 Esc는 메뉴만 닫는다. Dp*Picker와 같은 규약(window 캡처 + 전파 중단)이라
    // 모달·확인창의 document keydown(Esc 닫기)까지 번지지 않는다.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };

    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  // 정본 `.rg-dd` 열기 좌표 계산을 그대로 옮겼다: 폭은 트리거에 맞추고, 아래로 펼쳤을 때
  // 뷰포트를 넘치면 트리거 위로 뒤집는다. 높이를 알아야 하므로 0,0 에 놓고 측정한 뒤 확정한다.
  useLayoutEffect(() => {
    if (!isFixed || !open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;

      const rect = trigger.getBoundingClientRect();
      menu.style.width = menuAlign === "end" ? "" : `${rect.width}px`;
      menu.style.left = "0px";
      menu.style.top = "0px";
      const height = menu.offsetHeight || 90;
      const width = menuAlign === "end" ? menu.offsetWidth : rect.width;
      const left = menuAlign === "end" ? rect.right - width : rect.left;
      menu.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
      menu.style.top = `${
        rect.bottom + height + 8 > window.innerHeight
          ? Math.max(8, rect.top - height - 5)
          : rect.bottom + 5
      }px`;
    };
    place();
    // body 포탈이라 스크롤 컨테이너를 따라가지 않는다 — dp 팝업처럼 트리거를 다시 좇는다.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isFixed, menuAlign, open]);

  // fixed 메뉴는 body 포탈로 내보낸다. `overflow:clip/hidden` 조상(Panel titlebar 등)이 잘라내고,
  // drop-shadow 같은 `filter` 가 걸린 조상은 fixed 자손의 containing block 이 되어 같이 잘라낸다
  // — 그때는 z-index 를 아무리 올려도 소용없다.
  const wrapMenu = (node: ReactNode) => (isFixed ? createPortal(node, document.body) : node);

  // 프로토타입 공통 커스텀 드롭다운. 스타일은 Tailwind 유틸로 인라인화하되,
  // uc-dd/uc-dd-btn/uc-dd-menu/uc-opt 클래스명은 호출부의 [&_.uc-dd-btn]:… 오버라이드가
  // 계속 바인딩되도록 셀렉터 훅으로 유지한다(전역 CSS는 제거).
  return (
    <div
      ref={rootRef}
      className={`uc-dd ${isCompact ? "uc-dd--compact" : ""} ${isNotification ? "uc-dd--notification" : ""} ${open ? "open" : ""} relative flex-none`}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`uc-dd-btn inline-flex ${triggerSize} items-center ${isModal ? "" : "gap-[7px] tracking-[-0.01em]"} border ${open ? "border-blue" : "border-line"} bg-surface py-0 ${triggerLook} text-t1 outline-none transition-[border-color,box-shadow] duration-[120ms] disabled:cursor-default disabled:opacity-[.55] disabled:shadow-none ${open && !isModal ? "shadow-[0_0_0_3px_var(--color-blue-t)]" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={`uc-dd-lbl${isCell || isForm || isModal ? " min-w-0 truncate" : ""}${(isForm || isModal) && selected === undefined && placeholder !== undefined ? " font-medium text-t4" : ""}`}
        >
          {triggerLabel ?? selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </button>
      {open && wrapMenu(
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={`uc-dd-menu ${isForm ? "max-h-[230px] p-[5px]" : isModal ? "max-h-[240px] p-[6px]" : "max-h-[236px] p-[6px]"} overflow-auto rounded-xl border border-line bg-surface ${isModal ? "shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]" : "shadow-[0_14px_32px_-10px_rgba(23,31,40,0.22),0_2px_6px_rgba(23,31,40,0.06)]"} ${
            isFixed
              // field 는 메뉴 폭을 트리거에 맞추는 규격이라 140px 하한을 걸지 않는다.
              ? `fixed z-[1000] ${isField || menuAlign === "end" || menuMinWidth !== undefined ? "" : "min-w-[140px]"}`
              : `absolute ${isModal ? "top-[calc(100%_+_5px)]" : "top-[calc(100%_+_6px)]"} z-[80] ${isField ? "inset-x-0" : `right-0 ${menuMinWidth !== undefined ? "" : "min-w-[96px]"}`}`
          }${menuClassName ? ` ${menuClassName}` : ""}`}
          style={menuMinWidth !== undefined ? { minWidth: menuMinWidth } : undefined}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                // 정본 `.ac-opt` 에는 line-height 선언이 없어 `normal`(≈1.2)이다.
                // 명시하지 않으면 Tailwind 기본 1.5가 걸려 옵션이 항목당 ~4px 부푼다.
                className={`uc-opt ${isSelected ? "on" : ""} flex w-full items-center ${isField ? "justify-start" : "justify-between"} gap-2 rounded-lg ${isModal ? "px-[11px] py-[9px]" : "px-[10px] py-2"} text-[13px] leading-[normal] whitespace-nowrap transition-[background] duration-100 ${isSelected ? `bg-blue-t font-bold ${isModal ? "text-blue" : "text-blue-d"}` : "font-semibold text-t2 hover:bg-bg"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {!isField && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                    className={`h-[14px] w-[14px] flex-none ${isSelected && check === "selected" ? "opacity-100" : "opacity-0"}`}
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
