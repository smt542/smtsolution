import type { SVGProps } from "react";

export function BrandMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path
        d="M16 2.5 29.5 16 16 29.5 2.5 16 16 2.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="m10.2 15.2 5.8-4.5 5.8 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 14.6v6.2h8v-6.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14.6 20.8v-3.6h2.8v3.6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.2" cy="10" r="1.2" fill="#14A497" />
      <circle cx="23.8" cy="22" r="1.2" fill="#14A497" />
    </svg>
  );
}
