import type { SVGProps } from "react";

/** 정본 수화기 아이콘(현장 `.btel`, 세입자 확인 요청 `.call .ci`). 크기·색은 호출부 className으로 준다. */
export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
    </svg>
  );
}
