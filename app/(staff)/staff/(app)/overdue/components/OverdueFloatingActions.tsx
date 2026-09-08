/* eslint-disable @next/next/no-img-element -- Figma SVG assets are served unchanged from public. */

export function OverdueFloatingActions() {
  return (
    <>
      <button
        type="button"
        aria-label="보조 패널 열기"
        className="fixed right-0 top-1/2 z-30 hidden h-[70px] w-[30px] -translate-y-1/2 items-center justify-center rounded-l-[12px] border-y border-l border-line bg-white shadow-[-6px_0_8px_rgba(23,31,40,0.25)] xl:flex"
      >
        <img src="/icons/overdue/side-tab.svg" alt="" className="size-[18px]" />
      </button>
      <button
        type="button"
        aria-label="도움말 채팅 열기"
        className="fixed bottom-[22px] right-[22px] z-30 flex size-[52px] items-center justify-center rounded-full bg-teal shadow-[0_12px_14px_rgba(20,164,151,0.6)] transition hover:bg-teal-d"
      >
        <img src="/icons/overdue/chat.svg" alt="" className="size-[20px]" />
      </button>
    </>
  );
}
