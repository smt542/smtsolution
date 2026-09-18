import type { SVGProps } from "react";

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
        stroke="currentColor"
        strokeWidth="1.26667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 5V8L10 9.33333"
        stroke="currentColor"
        strokeWidth="1.26667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
