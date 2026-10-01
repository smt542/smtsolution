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
  // 정본 표 셀 편집칸 `.hc-in`·`.tc-in`(수납관리 수납 이력·입주자정보): 26/r7/12/400, 포커스 3px 청록 링.
  "26": "h-[26px] rounded-[7px] px-[7px] text-[12px] font-normal focus:ring-[3px] focus:ring-teal-t",
  // 정본 모달 입력칸 `.as-in`·`.lk-q`: 38/r10/px11/13, 포커스 청록 테두리+3px 링. 읽기 전용은 `.fmpc input[readonly]`.
  "38-13": "h-[38px] rounded-[10px] px-[11px] text-[13px] placeholder:font-medium focus:ring-[3px] focus:ring-teal-t [&[readonly]]:cursor-default [&[readonly]]:border-line2 [&[readonly]]:bg-bg [&[readonly]:focus]:border-line2 [&[readonly]:focus]:ring-0",
  "36": "h-[36px] rounded-[11px] px-[12px] text-[14px] font-bold",
  "38": "h-[38px] rounded-[11px] px-[12px] text-[14px] font-bold",
  "40": "h-[40px] rounded-[11px] px-[12px] text-[14px] font-bold",
  // 정본 통합관리자 모달 입력칸 `.hf-in2`(계정·권한): 42/r10/px13/13.5/600. placeholder 규칙이 없어 Chrome 기본 #757575(굵기는 칸 글자 600),
  // 포커스 청록 테두리+3px 링. 오류 표시는 호출부가 `border-red!`(정본 `.bad{border-color:red!important}`)로 준다.
  "42": "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold leading-[normal] placeholder:text-[#757575] focus:ring-[3px] focus:ring-[rgba(20,164,151,0.14)]",
  legacy: "h-11 rounded-xl px-4 text-sm",
} as const;

export type InputSize = keyof typeof SIZES;

// ComponentPropsWithRef라서 ref가 그대로 내려간다(React 19에서 ref는 일반 prop이다).
// PhoneInput처럼 커서를 직접 다뤄야 하는 래퍼가 이걸 쓴다.
type InputProps = Omit<React.ComponentPropsWithRef<"input">, "size"> & {
  size?: InputSize | number;
  /** 기존 화면의 고유 className/스타일을 그대로 유지하며 공통 DOM만 재사용한다. */
  unstyled?: boolean;
};

/**
 * 호출부가 직접 지정한 것과 겹치는 기본값을 뺀다. Button과 같은 방침이며, 이유도 같다 —
 * 둘 다 남기면 명시도가 같아 결과가 CSS 생성 순서에 좌우된다.
 *
 * 폭이 특히 중요하다. 기본값 `w-full`을 남긴 채 호출부가 `w-[240px]`를 주면 둘 중
 * 어느 쪽이 이길지 불확정이고, `w-full`이 이기면 인풋이 행을 다 먹어 옆의 라벨이 짓눌린다.
 */
function dropOverridden(defaults: string, className: string): string {
  const yieldWidth = /(?:^|\s)!?w-/.test(className);
  const yieldDisabled = /\bdisabled:(bg|text|opacity|border)-/.test(className);
  if (!yieldWidth && !yieldDisabled) return defaults;
  return defaults
    .split(" ")
    .filter((c) => !(yieldWidth && c === "w-full"))
    .filter((c) => !(yieldDisabled && c.startsWith("disabled:")))
    .join(" ");
}

export function inputClassName(size: InputSize = "legacy", className = ""): string {
  // size가 placeholder 색을 정하면(정본 `.hf-in2`) 기본 t4를 넣지 않는다 — 둘이 남으면 CSS 순서가 이긴다.
  const placeholderDefault = SIZES[size].includes("placeholder:text-") ? "" : " placeholder:text-t4";
  const defaults = `${SIZES[size]} w-full border border-line bg-surface text-t1${placeholderDefault} focus:border-brand focus:outline-none disabled:opacity-70`;
  return `${dropOverridden(defaults, className)} ${className}`;
}

export function Input({ className = "", size = "legacy", unstyled = false, ...props }: InputProps) {
  const nativeSize = typeof size === "number" ? size : undefined;
  const styledSize = typeof size === "number" ? "legacy" : size;
  return <input size={nativeSize} className={unstyled ? className : inputClassName(styledSize, className)} {...props} />;
}
