// 새로고침 중 표시 — 정본 Messenger `.rnb-prog`(패널 맨 위 3px 막대)·`.rnb-skel`(카드 스켈레톤 4개).

const SKELETON_LINE_CLASS =
  "rounded-[6px] bg-[linear-gradient(90deg,#EEF1F4_25%,#F7F9FB_37%,#EEF1F4_63%)] bg-[length:400%_100%] animate-[rnb-sk_1.3s_ease-in-out_infinite] motion-reduce:animate-none";

export function RailRefreshBar() {
  return (
    <div
      className="absolute inset-x-0 top-0 z-[5] h-[3px] overflow-hidden bg-blue-t2"
      role="progressbar"
      aria-label="A/S 접수·퇴실 신청 새로고침 중"
      data-rail-progress
    >
      <i className="block h-full w-[40%] rounded-[999px] bg-blue animate-[rnb-bar_1s_ease-in-out_infinite] motion-reduce:animate-none" />
    </div>
  );
}

export function RailRefreshSkeleton() {
  return (
    <div className="flex flex-none flex-col gap-[10px] p-[14px]" aria-hidden="true" data-rail-skeleton>
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="flex flex-col gap-[9px] rounded-[12px] border border-line bg-white p-[13px]"
        >
          <div className={`h-[11px] w-[40%] ${SKELETON_LINE_CLASS}`} />
          <div className={`h-4 w-[90%] ${SKELETON_LINE_CLASS}`} />
          <div className={`h-[11px] w-[70%] ${SKELETON_LINE_CLASS}`} />
        </div>
      ))}
    </div>
  );
}
