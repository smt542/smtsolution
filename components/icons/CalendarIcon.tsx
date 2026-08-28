import type { SVGProps } from "react";

/** Figma 673:18990 — 15×15 calendar, stroke → currentColor. */
export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M11.25 3.125H3.75C2.88706 3.125 2.1875 3.82456 2.1875 4.6875V11.5625C2.1875 12.4254 2.88706 13.125 3.75 13.125H11.25C12.1129 13.125 12.8125 12.4254 12.8125 11.5625V4.6875C12.8125 3.82456 12.1129 3.125 11.25 3.125Z"
        stroke="currentColor"
        strokeWidth="1.1875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 1.875V4.375M10 1.875V4.375M2.1875 6.25H12.8125"
        stroke="currentColor"
        strokeWidth="1.1875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
