import type { SVGProps } from "react";

/** Figma 673:19424 — 16×16 printer, stroke → currentColor. */
export function PrinterIcon(props: SVGProps<SVGSVGElement>) {
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
        d="M4.66667 5.33333V2.66667H11.3333V5.33333"
        stroke="currentColor"
        strokeWidth="1.26667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.33333H4C3.26362 5.33333 2.66667 5.93029 2.66667 6.66667V9.33333C2.66667 10.0697 3.26362 10.6667 4 10.6667H12C12.7364 10.6667 13.3333 10.0697 13.3333 9.33333V6.66667C13.3333 5.93029 12.7364 5.33333 12 5.33333Z"
        stroke="currentColor"
        strokeWidth="1.26667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.66667 10.6667H11.3333V13.3333H4.66667V10.6667Z"
        stroke="currentColor"
        strokeWidth="1.26667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
