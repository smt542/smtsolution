import type { SVGProps } from "react";

/** Figma 673:39839 — 16×16 filter/funnel, stroke → currentColor. */
export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M2.8 3.5h10.4a.5.5 0 0 1 .38.82L9.5 9v3.7a.5.5 0 0 1-.28.45l-2 1a.5.5 0 0 1-.72-.45V9L2.42 4.32A.5.5 0 0 1 2.8 3.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
