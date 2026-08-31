import type { SVGProps } from "react";

/** Figma 673:39842 — 16×16 search/magnifier, stroke → currentColor. */
export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="7.2" cy="7.2" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 13.5l-2.9-2.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
