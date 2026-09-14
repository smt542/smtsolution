"use client";

/** Figma 상단 헤더 바 (16:15324): 햄버거 + 브레드크럼 + 제목 + 뒤로가기/저장. */
export function RegisterHeader({
  title,
  backLabel,
  saveLabel,
  onBack,
  onSave,
  saving,
}: {
  title: string;
  backLabel: string;
  saveLabel: string;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div className="flex h-[62px] shrink-0 items-center gap-[12px] border-b border-line bg-surface px-[24px]">
      {/* 햄버거: Topbar 와 동일 구조 — AppShell 이 hasIntegratedHeader 로 Topbar 를 숨기므로 여기서 직접 dispatch */}
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => window.dispatchEvent(new Event("app-shell:toggle-sidebar"))}
        className="mr-[2px] flex size-[36px] shrink-0 items-center justify-center rounded-[10px] text-t2 transition-colors hover:bg-bg"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[20px]"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex flex-col">
        <p className="leading-[normal] text-[12px] font-semibold text-t3">건물·입주자 관리</p>
        <p className="leading-[normal] text-[19px] font-extrabold tracking-[-0.38px] text-t1">{title}</p>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onBack}
        className="flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex h-[40px] items-center rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)] hover:bg-teal-d disabled:opacity-60"
      >
        {saving ? "저장 중…" : saveLabel}
      </button>
    </div>
  );
}
