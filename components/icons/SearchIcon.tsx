import type { SVGProps } from "react";

/** Figma 673:39842 — 16×16 search/magnifier, stroke → currentColor. */
export function SearchIcon({
  variant = "default",
  ...props
}: SVGProps<SVGSVGElement> & { variant?: "default" | "building-register" }) {
  if (variant === "building-register") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
        <path
          d="M7.33333 12C9.91066 12 12 9.91066 12 7.33333C12 4.756 9.91066 2.66667 7.33333 2.66667C4.756 2.66667 2.66667 4.756 2.66667 7.33333C2.66667 9.91066 4.756 12 7.33333 12Z"
          stroke="currentColor"
          strokeWidth="1.33333"
          strokeLinecap="round"
        />
        <path
          d="M13.3333 13.3333L11.3333 11.3333"
          stroke="currentColor"
          strokeWidth="1.33333"
          strokeLinecap="round"
        />
      </svg>
    );
  }

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
