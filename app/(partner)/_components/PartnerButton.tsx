import type { ButtonHTMLAttributes } from "react";
import { dropOverridden } from "@/components/common/buttonOverride";

/**
 * 현장관리자 앱 공통 버튼. 규격은 정본 `partner/*.dc.html`에서 실측했다.
 * 웹(staff·admin)은 `components/common/Button`을 쓰고, 모바일 두 앱은 정본이 달라 앱마다 따로 둔다.
 * API(`variant`·`size`, className 양보 규칙)는 웹 Button과 같다.
 *
 * size
 * - `std`   하단 액션 버튼 `.btn`(52/r15/15.5) — AS·AS 접수·검침·이사정산 등록
 * - `md`    확인창 버튼 `.cf-btn`(48/r14/15) — AS·검침·이사정산 등록
 * - `sm`    프로필 확인창 `.cf-btn`·영수증 폼 `.rc-f .btn`(46/r13/14.5)
 * - `login` 로그인 `#mlSubmit`(56/r15/16, 청록 그림자)
 *
 * variant
 * - `primary`   청록 채움(`.pri`·`.k`)
 * - `secondary` 회색 채움(`.sec2`·`.c`)
 * - `danger`    빨강 채움(`.r`·`.del`)
 * - `ghost`     흰 배경 + 테두리(프로필 로그아웃 `#pfOut`). 웹 Button의 `ghost`와 같은 뜻이다.
 *
 * 정본 버튼은 `display:flex`로 가운데 정렬하고, 폭(`flex:1`·`width:100%`)은 호출부가 정한다.
 * 정본에는 비활성 규칙이 없어, 앱이 써 온 opacity .7을 기본으로 둔다.
 */
const SIZES = {
  std: "flex items-center justify-center h-[52px] rounded-[15px] text-[15.5px] font-bold",
  md: "flex items-center justify-center h-12 rounded-[14px] text-[15px] font-bold",
  sm: "flex items-center justify-center h-[46px] rounded-[13px] text-[14.5px] font-bold",
  login:
    "flex items-center justify-center h-14 rounded-[15px] text-base font-bold shadow-[0_10px_20px_-8px_rgba(20,164,151,0.55)]",
} as const;

const VARIANTS = {
  primary: "bg-blue text-white",
  secondary: "bg-bg text-t2",
  danger: "bg-red text-white",
  ghost: "bg-white text-t2 border border-line",
} as const;

const DISABLED = "disabled:opacity-70";

type PartnerButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  size?: keyof typeof SIZES;
  variant?: keyof typeof VARIANTS;
  className?: string;
};

export function PartnerButton({ size = "std", variant = "primary", className = "", ...rest }: PartnerButtonProps) {
  const defaults = `${DISABLED} ${VARIANTS[variant]}`;
  return <button className={`${SIZES[size]} ${dropOverridden(defaults, className)} ${className}`} {...rest} />;
}
