"use client";

/**
 * 파트너 앱 공용 체크박스 — 로그인 「자동 로그인」의 정본 모양(둥근 22px 박스 · 파랑 채움 · 흰 체크)을
 * 한 곳에 둔다. 실제 입력은 숨긴 native checkbox 라 키보드(Space)·스크린리더가 그대로 동작한다.
 * size="sm": 목록 상단 필터 등 좁은 자리(19px 박스 · 13px 라벨).
 */
export function PartnerCheckbox({
  checked,
  onChange,
  label,
  size = "md",
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
}) {
  const sm = size === "sm";
  return (
    <label
      className={`inline-flex select-none items-center ${sm ? "gap-[7px]" : "gap-[9px]"} ${disabled ? "cursor-default opacity-60" : "cursor-pointer"} ${className}`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={`flex flex-none items-center justify-center border-[1.6px] transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-blue-t ${
          sm ? "size-[19px] rounded-[6px] [&_svg]:size-[11px]" : "size-[22px] rounded-[7px] [&_svg]:size-[13px]"
        } ${checked ? "border-blue bg-blue" : "border-line bg-white"}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={checked ? "opacity-100" : "opacity-0"}
        >
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      </span>
      <span className={`font-semibold text-t2 ${sm ? "text-[13px]" : "text-sm"}`}>{label}</span>
    </label>
  );
}
