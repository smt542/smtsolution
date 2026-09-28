import type { ReactNode } from "react";

/** 진입 알림 모달 내 세대 1줄 카드 (이름 + 서브텍스트 + 우측 slot). */
export function EntryAlertCard({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    // 정본 `.up-row{padding:13px 15px;gap:10px}`: 높이는 두 줄 글자가 정한다.
    <div className="flex items-center justify-between gap-[10px] rounded-[12px] border border-line px-[15px] py-[13px]">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-t1">{title}</p>
        <p className="mt-[2px] truncate text-[12px] font-semibold text-t3">{subtitle}</p>
      </div>
      {trailing}
    </div>
  );
}
