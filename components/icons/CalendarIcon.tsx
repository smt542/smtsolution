import type { SVGProps } from "react";

/** Figma 673:18990 — 15×15 calendar, stroke → currentColor. */
export function CalendarIcon({
  variant = "default",
  ...props
}: SVGProps<SVGSVGElement> & {
  variant?: "default" | "building-register" | "messenger-date" | "messenger-repeat";
}) {
  if (variant === "messenger-date") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
        <path
          d="M12.3333 3H3.66667C2.74619 3 2 3.74619 2 4.66667V12C2 12.9205 2.74619 13.6667 3.66667 13.6667H12.3333C13.2538 13.6667 14 12.9205 14 12V4.66667C14 3.74619 13.2538 3 12.3333 3Z"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 6H14M5.33333 2V4M10.6667 2V4"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "messenger-repeat") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
        <path
          d="M11.3333 1.33333V4M4.66667 1.33333V4M2 6.66667H14"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.3333 3H3.66667C2.74619 3 2 3.74619 2 4.66667V12C2 12.9205 2.74619 13.6667 3.66667 13.6667H12.3333C13.2538 13.6667 14 12.9205 14 12V4.66667C14 3.74619 13.2538 3 12.3333 3Z"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "building-register") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
        <path
          d="M12 3.33333H4C3.26362 3.33333 2.66667 3.93029 2.66667 4.66667V12.6667C2.66667 13.403 3.26362 14 4 14H12C12.7364 14 13.3333 13.403 13.3333 12.6667V4.66667C13.3333 3.93029 12.7364 3.33333 12 3.33333Z"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.33333 2V4.66667M10.6667 2V4.66667M2.66667 6.66667H13.3333"
          stroke="currentColor"
          strokeWidth="1.26667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

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
