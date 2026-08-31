import type { SVGProps } from "react";

export function MenuIcon({
  variant = "default",
  ...props
}: SVGProps<SVGSVGElement> & { variant?: "default" | "building-register" }) {
  if (variant === "building-register") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
        <path
          d="M3.33333 5H16.6667M3.33333 10H16.6667M3.33333 15H16.6667"
          stroke="currentColor"
          strokeWidth="0.833333"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
