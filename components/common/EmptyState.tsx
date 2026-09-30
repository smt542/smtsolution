import type { ReactNode } from "react";

type EmptyStateProps =
  | { message: string }
  | {
      /** 정본 빈 결과(아이콘 상자 + 제목 + 설명). 부모 flex 열의 남은 높이를 채우고 가운데에 둔다. */
      title: string;
      description?: ReactNode;
      /** 상자 안 27px 아이콘. 생략하면 달력 */
      icon?: ReactNode;
    };

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[27px]"
    >
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  );
}

export function EmptyState(props: EmptyStateProps) {
  if ("title" in props) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[5px] px-[24px] pb-[52px] pt-[44px] text-center">
        <div className="mb-[4px] flex size-[56px] items-center justify-center rounded-[17px] bg-blue-t text-blue">
          {props.icon ?? <CalendarGlyph />}
        </div>
        {/* 정본은 제목 line-height 를 선언하지 않아 normal 이다. Tailwind 기본 1.5 면 제목이 커져 설명이 밀린다. */}
        <p className="text-[16px] font-bold leading-[normal] tracking-[-0.02em] text-t1">{props.title}</p>
        {props.description ? (
          <p className="text-[13.5px] font-normal leading-[1.6] text-t3">{props.description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-t4">{props.message}</p>
    </div>
  );
}
