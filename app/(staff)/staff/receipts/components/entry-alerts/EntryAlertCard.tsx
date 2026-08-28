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
    <div className="flex h-[61px] items-center justify-between gap-3 rounded-[12px] border border-line px-[15px]">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-t1">{title}</p>
        <p className="truncate pt-[2px] text-[12px] font-semibold text-t3">{subtitle}</p>
      </div>
      {trailing}
    </div>
  );
}
