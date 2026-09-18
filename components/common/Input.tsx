import React from "react";

/**
 * 공통 인풋.
 *
 * `size`는 Figma 실측 규격이다(`docs/superpowers/plans/2026-09-18-setup-figma-tokens.md`).
 * Button과 마찬가지로 Tailwind 명시도가 같아 `h-11`과 `h-[38px]`가 함께 남으면 승자가 CSS
 * 생성 순서로 정해지므로, size가 주는 값은 `className`으로 덮어쓸 수 없다. 필요한 규격이
 * 없으면 여기에 추가한다. 키가 숫자인 것은 이 규격들이 의미가 아니라 순수 치수이기 때문이다.
 *
 * 네이티브 `size` 속성(문자 폭)은 이 저장소에서 쓰는 곳이 없어 타입에서 뺐다.
 */
const SIZES = {
  "36": "h-[36px] rounded-[11px] px-[12px] text-[14px] font-bold",
  "38": "h-[38px] rounded-[11px] px-[12px] text-[14px] font-bold",
  "40": "h-[40px] rounded-[11px] px-[12px] text-[14px] font-bold",
  legacy: "h-11 rounded-xl px-4 text-sm",
} as const;

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: keyof typeof SIZES;
};

/**
 * 호출부가 비활성 표시를 직접 정의했으면 컴포넌트 기본값을 뺀다. Button과 같은 방침이며,
 * 이유도 같다 — 둘 다 남기면 명시도가 같아 결과가 CSS 생성 순서에 좌우된다.
 */
function dropOverridden(defaults: string, className: string): string {
  if (!/\bdisabled:(bg|text|opacity|border)-/.test(className)) return defaults;
  return defaults
    .split(" ")
    .filter((c) => !c.startsWith("disabled:"))
    .join(" ");
}

export function Input({ className = "", size = "legacy", ...props }: InputProps) {
  const defaults = `${SIZES[size]} w-full border border-line bg-surface text-t1 placeholder:text-t4 focus:border-brand focus:outline-none disabled:opacity-70`;
  return (
    <input className={`${dropOverridden(defaults, className)} ${className}`} {...props} />
  );
}
