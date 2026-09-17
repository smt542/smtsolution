import React from "react";

/**
 * 공통 버튼.
 *
 * `size`는 프로토타입 정본(`.dc.html`)에서 실측한 규격이다. 호출부에서 `className`으로
 * 덮어쓸 수 없다 — Tailwind 유틸리티는 명시도가 같아 `h-11`과 `h-[40px]`가 함께 남으면
 * 승자가 CSS 생성 순서로 정해지기 때문이다. 필요한 규격이 없으면 여기에 추가한다.
 *
 * - `std`    정본 표준 액션 버튼(40/r11/13.5). 조사한 staff 정본 9개 화면 전부에 등장.
 * - `sm`     소형 액션 버튼(26/r8/11.5).
 * - `legacy` 현행 기본값(44/r12/14). 정본에서는 업데이트 팝업 1곳에만 쓰이는 규격이라
 *            `std`로 교정 예정이며, 교체 전까지 기존 호출부 호환을 위해 기본값으로 둔다.
 *            자세한 배경은 `docs/superpowers/plans/2026-09-17-button-consolidation.md`.
 *
 * 좌우 패딩은 같은 높이 안에서도 정본이 갈리므로(40px 기준 18/15/20px) 각 size에는
 * 최빈값만 담았다. 다른 패딩이 필요하면 size를 새로 정의한다.
 */
const SIZES = {
  std: "h-10 rounded-btn px-[18px] text-[13.5px]",
  sm: "h-[26px] rounded-lg px-[10px] text-[11.5px]",
  legacy: "h-11 rounded-xl px-4 text-sm",
} as const;

export function Button({
  variant = "primary",
  size = "legacy",
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
