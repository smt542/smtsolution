interface SpinnerProps {
  label?: string;
  className?: string;
  size?: "small" | "medium";
  showLabel?: boolean;
}

export function Spinner({
  label = "불러오는 중",
  className = "",
  size = "medium",
  showLabel = false,
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`flex items-center justify-center gap-2 ${showLabel ? "text-sm font-semibold text-t3" : ""} ${className || "p-4"}`}
    >
      <span
        aria-hidden="true"
        className={`${size === "small" ? "h-4 w-4" : "h-6 w-6"} shrink-0 animate-spin rounded-full border-2 border-line border-t-brand`}
      />
      {showLabel ? <span>{label}</span> : null}
    </div>
  );
}
