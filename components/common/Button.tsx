import React from "react";

/**
 * 공통 버튼.
 *
 * `size`는 프로토타입 정본(`.dc.html`)에서 실측한 규격이다. 호출부에서 `className`으로
 * 덮어쓸 수 없다 — Tailwind 유틸리티는 명시도가 같아 `h-11`과 `h-[40px]`가 함께 남으면
 * 승자가 CSS 생성 순서로 정해지기 때문이다. 필요한 규격이 없으면 여기에 추가한다.
 *
 * - `std`    정본 디자인시스템 버튼 `.hf-btn`과 동일(40/r11/13.5, padding 0 15px, gap 6px).
 *            정본 7개 화면에서 69회 쓰이는 표준이다.
 * - `sm`     소형 액션 버튼(26/r8/11.5).
 * - `legacy` 구 기본값(44/r12/14). 정본에서는 업데이트 팝업 1곳에만 쓰이는 규격이라
 *            기본값에서 내렸다. 정본이 실제로 44px인 팝업 버튼에만 명시적으로 쓴다.
 *            자세한 배경은 `docs/superpowers/plans/2026-09-17-button-consolidation.md`.
 */
const SIZES = {
  std: "inline-flex items-center justify-center gap-1.5 h-10 rounded-btn px-[15px] text-[13.5px] whitespace-nowrap",
  sm: "h-[26px] rounded-lg px-[10px] text-[11.5px]",
  legacy: "h-11 rounded-xl px-4 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "std",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: keyof typeof SIZES;
}) {
  const v = {
    primary: "bg-brand text-white shadow-pri hover:bg-brand-dark",
    ghost: "bg-white text-t2 border border-line hover:bg-bg",
    danger: "bg-danger text-white",
  }[variant];
  return (
    <button
      className={`${SIZES[size]} font-bold disabled:opacity-70 ${v} ${className}`}
      {...props}
    />
  );
}
