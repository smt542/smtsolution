"use client";

/**
 * 공지 대상 건물 선택 칩(체크박스 pill). Figma 27:21410 계열.
 * 상세 모달·등록 폼이 공유한다. 선택 시 청록 채움 + 흰 체크.
 */
export function NoticeTargetChip({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={
        checked
          ? "flex h-[36px] items-center gap-[7px] rounded-[10px] border border-[#14a497] bg-[#e2f5f1] px-[13px]"
          : "flex h-[36px] items-center gap-[7px] rounded-[10px] border border-[#e8ebee] bg-white px-[13px]"
      }
    >
      <span
        className={
          checked
            ? "flex size-[16px] items-center justify-center rounded-[5px] border border-[#14a497] bg-[#14a497]"
            : "size-[16px] rounded-[5px] border border-[#b0b8c1]"
        }
      >
        {checked ? (
          <svg viewBox="0 0 12 12" fill="none" className="size-[11px]" aria-hidden="true">
            <path d="M2.5 6.2 5 8.4 9.5 3.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className={`text-[13px] font-bold leading-[normal] ${checked ? "text-[#14a497]" : "text-[#4e5968]"}`}>
        {label}
      </span>
    </button>
  );
}
