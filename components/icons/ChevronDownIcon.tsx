import type { SVGProps } from "react";

/** Figma 14×14 chevron-down, stroke → currentColor. */
export function ChevronDownIcon({
  variant = "default",
  ...props
}: SVGProps<SVGSVGElement> & {
  variant?: "default" | "building-register-field" | "building-register-section";
}) {
  if (variant === "building-register-section") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
        <path
          d="M4.5 6.75L9 11.25L13.5 6.75"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "building-register-field") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.33333" />
      </svg>
    );
  }

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
        d="M3.5 5.25L7 8.75L10.5 5.25"
        stroke="currentColor"
        strokeWidth="1.16667"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
