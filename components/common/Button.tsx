import React from "react";
import { dropOverridden } from "./buttonOverride";

/**
 * 공통 버튼.
 *
 * `size`는 프로토타입 정본(`.dc.html`)에서 실측한 규격이다. Tailwind 유틸리티는 명시도가
 * 같아 `h-11`과 `h-[40px]`가 함께 남으면 승자가 CSS 생성 순서로 정해지므로, size가 주는
 * 값은 `className`으로 덮어쓸 수 없다. 필요한 규격이 없으면 여기에 추가한다.
 *
 * - `std`    정본 디자인시스템 버튼 `.hf-btn`과 동일(40/r11/13.5, padding 0 15px, gap 6px).
 *            정본 7개 화면에서 69회 쓰이는 표준이다.
 * - `sm`     소형 액션 버튼(26/r8/11.5). 정본의 26px 버튼은 전부 흰 배경+테두리라
 *            채워진 소형 버튼 규격이 없다. 그래서 `sm`은 `ghost`만 허용한다.
 * - `legacy` 구 기본값(44/r12/14). 정본에서는 업데이트 팝업 1곳에만 쓰이는 규격이라
 *            기본값에서 내렸다. 정본이 실제로 44px인 팝업 버튼에만 명시적으로 쓴다.
 * - `login`  로그인 제출 버튼(50/r14/15, 굵기 800). 정본 staff·admin 로그인의 `#lgSubmit`과
 *            동일하다. 정본에 그림자가 없으므로 호출부에서 `shadow-none`을 준다.
 * - `md`     정본 조회 모달 `.hf-btn.sec.lk-go`(인라인 height:38px). `.lk-go{padding:0 14px;font-size:13px}`는
 *            뒤에 오는 `.hf-btn` 규칙에 눌려 실제 렌더는 `std`와 같은 13.5px·padding 15px다.
 * - `wide`   정본 `.lg-print`·`.fmpc-btn` 와이드 버튼(40/r11/13.5, padding 0 18px, gap 7px).
 *
 * 굵기도 규격의 일부라 size가 정한다(`login`만 800). 기본값으로 따로 두면 `font-bold`와
 * 호출부 굵기가 함께 남아 위와 같은 명시도 문제가 생긴다.
 *
 * 자세한 배경은 `docs/superpowers/plans/2026-09-17-button-consolidation.md`.
 */
const SIZES = {
  std: "inline-flex items-center justify-center gap-1.5 h-10 rounded-btn px-[15px] text-[13.5px] font-bold whitespace-nowrap",
  sm: "h-[26px] rounded-lg px-[10px] text-[11.5px] font-bold",
  legacy: "h-11 rounded-xl px-4 text-sm font-bold",
  login: "h-[50px] rounded-[14px] text-[15px] font-extrabold",
  md: "inline-flex items-center justify-center gap-1.5 h-[38px] rounded-btn px-[15px] text-[13.5px] font-bold whitespace-nowrap",
  wide: "inline-flex items-center justify-center gap-[7px] h-10 rounded-btn px-[18px] text-[13.5px] font-bold tracking-[-0.01em] whitespace-nowrap",
} as const;

/**
 * - `dangerTint` 연빨강. 정본 입주자 상세 퇴실처리(`.hf-btn.sec`에 인라인으로 `--red-t` 배경·테두리,
 *   `--red` 글자). 정본에 hover가 없다.
 */
const VARIANTS = {
  primary: "bg-brand text-white shadow-pri hover:bg-brand-dark",
  ghost: "bg-white text-t2 border border-line hover:bg-bg",
  danger: "bg-danger text-white",
  dangerTint: "border border-red-t bg-red-t text-red",
  // 정본 A/S 상세 삭제 `.hf-btn.sec`: 빨간 테두리·글자, hover 없음.
  dangerOutline: "border border-red bg-white text-red",
} as const;

/**
 * 비활성 표시. 정본은 opacity가 아니라 회색 배경 + 흐린 글자를 쓴다
 * (`.pri:disabled`·`.lg-print:disabled`·`.fmpc-btn:disabled` 등 전부 동일 패턴).
 */
const DISABLED = "disabled:bg-bg disabled:text-t4";

type ButtonBaseProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  className?: string;
};

/**
 * `sm`에 채움 variant를 쓸 수 없도록 타입으로 막는다 — 정본에 없는 조합이다.
 * 앱에 이미 있는 채워진 26px 버튼 6개소는 정본 근거가 없어 raw `<button>`으로 남겨 뒀다.
 */
type ButtonProps = ButtonBaseProps &
  (
    | { size?: "std" | "legacy" | "login" | "md" | "wide"; variant?: keyof typeof VARIANTS }
    | { size: "sm"; variant?: "ghost" }
  );

export function Button({ className = "", ...props }: ButtonProps) {
  const { size = "std", variant, ...rest } = props as {
    size?: keyof typeof SIZES;
    variant?: keyof typeof VARIANTS;
  } & ButtonBaseProps;
  const resolved = variant ?? (size === "sm" ? "ghost" : "primary");
  const defaults = `${DISABLED} ${VARIANTS[resolved]}`;
  return (
    <button
      className={`${SIZES[size]} ${dropOverridden(defaults, className)} ${className}`}
      {...rest}
    />
  );
}
