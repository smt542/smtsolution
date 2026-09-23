import type { SVGProps } from "react";

/** 정본 building-list `ic.card` — 입주자카드(인물 카드) 24 뷰박스, stroke → currentColor. */
export function IdCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.2" />
      <path d="M8.5 17a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}
