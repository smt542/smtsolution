/** Figma 673:40298 — 건물 미선택 시 입주민 영역 빈 상태. */
export function TenantEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[6px] overflow-auto px-[24px] pb-[64px] pt-[56px] text-center">
      <span className="mb-[6px] flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-teal-t text-teal">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[28px] w-[28px]"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      </span>
      <p className="text-[16px] font-semibold leading-[normal] tracking-[-0.32px] text-t1">건물을 선택해 주세요</p>
      <p className="text-[13.5px] leading-[1.55] text-t3">
        위 전체 건물 목록에서 건물을 선택하면
        <br />
        해당 건물의 입주민이 여기에 표시돼요
      </p>
    </div>
  );
}
