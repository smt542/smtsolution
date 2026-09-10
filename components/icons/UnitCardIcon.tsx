import type { SVGProps } from "react";

/** Figma empty-state unit/card glyph. */
export function UnitCardIcon({
  variant = "default",
  ...props
}: SVGProps<SVGSVGElement> & {
  variant?: "default" | "receipt-history";
}) {
  if (variant === "receipt-history") {
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 14h5" />
      </svg>
    );
  }

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10H16M8 14H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
