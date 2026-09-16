import type { SVGProps } from "react";

/** Figma 27:21437 — 15×15 send/paper-plane (재전송). stroke → currentColor. */
export function SendIcon(props: SVGProps<SVGSVGElement>) {
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
        d="M2.5 7.5L12.5 2.5L8.75 12.5L7.1875 8.4375L2.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
