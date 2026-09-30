import type { SVGProps } from "react";

/** 정본 `.adj-zoom` 확대 돋보기 — 24 viewBox, stroke 2 → currentColor. */
export function ZoomInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2M8 11h6M11 8v6" />
    </svg>
  );
}
