import type { ButtonHTMLAttributes } from "react";
import { dropOverridden } from "@/components/common/buttonOverride";

/**
 * 세입자 앱 공통 버튼. 규격은 정본 `resident/*.dc.html`에서 실측했다.
 * 웹(staff·admin)은 `components/common/Button`을 쓰고, 모바일 두 앱은 정본이 달라 앱마다 따로 둔다.
 * API(`variant`·`size`, className 양보 규칙)는 웹 Button과 같다.
 *
 * size
 * - `sm`      관리비 상세 계좌 복사 `.ab`(42/r12/13, 아이콘 14px)
 * - `std`     시트·홈 공지 확인 `.sheet-btn`·`.nm-btn`(52/r14/15.5)
 * - `md`      확인창 `.cf-btn`(50/r14/15)
 * - `lg`      본인인증 확인 요청 `.sbtn`(54/r15/16)
 * - `xl`      온보딩 CTA `.btn`·카카오 `.kakao`(56/r16/16.5, 자간 -.02em, 누르면 98.5%로 줄어듦)
 * - `moveOut` 퇴실 신청 `.ms-btn`(52/r14/15.5, 굵기 800, 자간 -.02em). 정본 비활성은 `--line` 배경이라
 *             호출부에서 `disabled:bg-line disabled:text-t4`를 준다.
 *
 * variant — hover는 정본 규칙을 따른다.
 * - `primary`     청록 채움, hover 진한 청록
 * - `primaryTint` 연청록(`.ab`), hover `#D3EEE8`
 * - `secondary`   회색 채움, hover `--line`(`.ms-btn.ghost`·`.cf-btn`)
 * - `danger`      빨강 채움, hover 밝기 94%
 * - `kakao`       카카오 노랑, hover 밝기 97%
 *
 * 비활성은 정본 `.sbtn:disabled`처럼 회색 배경 + 흐린 글자다. 폭은 호출부가 정한다.
 * 링크(`<a>`)를 같은 규격으로 그려야 하면 `residentButtonClass()`를 쓴다(카카오 로그인).
 */
const SIZES = {
  sm: "flex items-center justify-center gap-1.5 h-[42px] rounded-xl text-[13px] font-bold [&_svg]:size-3.5",
  std: "h-[52px] rounded-[14px] text-[15.5px] font-bold",
  md: "h-[50px] rounded-[14px] text-[15px] font-bold",
  lg: "h-[54px] rounded-[15px] text-base font-bold",
  xl: "h-14 rounded-2xl text-[16.5px] font-bold tracking-[-0.02em] transition-transform active:scale-[0.985]",
  moveOut: "h-[52px] rounded-[14px] text-[15.5px] font-extrabold tracking-[-0.02em]",
} as const;

const VARIANTS = {
  primary: "bg-blue text-white hover:bg-blue-d",
  primaryTint: "bg-blue-t text-blue-d hover:bg-[#d3eee8]",
  secondary: "bg-bg text-t2 hover:bg-line",
  danger: "bg-red text-white hover:brightness-[.94]",
  kakao: "bg-kakao text-kakao-t hover:brightness-[0.97]",
} as const;

const DISABLED = "disabled:bg-bg disabled:text-t4";

type ResidentButtonStyle = {
  size?: keyof typeof SIZES;
  variant?: keyof typeof VARIANTS;
  className?: string;
};

export function residentButtonClass({ size = "std", variant = "primary", className = "" }: ResidentButtonStyle): string {
  const defaults = `${DISABLED} ${VARIANTS[variant]}`;
  return `${SIZES[size]} ${dropOverridden(defaults, className)} ${className}`;
}

type ResidentButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & ResidentButtonStyle;

export function ResidentButton({ size, variant, className, ...rest }: ResidentButtonProps) {
  return <button className={residentButtonClass({ size, variant, className })} {...rest} />;
}
