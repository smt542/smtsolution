import type { SVGProps } from "react";

/** Figma 673:18981 — 14×14 close/X, stroke → currentColor. */
export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.28333"
        strokeLinecap="round"
      />
    </svg>
  );
}
