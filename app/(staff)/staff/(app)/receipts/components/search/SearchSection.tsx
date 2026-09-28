import type { ReactNode } from "react";

/**
 * 통합 조회 모달의 섹션 래퍼. (Figma 669-12771)
 * 청록 액센트 바 + 섹션 제목 + 우측 액션(입력·조회 버튼) + 하단 결과 테이블 2열.
 */
export function SearchSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[14px] border border-line bg-bg px-[12px] pb-[12px] pt-[11px]">
      <div className="mb-[12px] flex shrink-0 items-center gap-[8px]">
        <h3 className="mr-[4px] inline-flex flex-none items-center gap-[7px] whitespace-nowrap text-[13.5px] font-extrabold tracking-[-0.02em] text-t1">
          <span aria-hidden className="h-[14px] w-[3px] flex-none rounded-[2px] bg-blue" />
          {title}
        </h3>
        <div className="flex-1" />
        {actions}
      </div>
      <div className="mt-[10px] grid min-h-0 flex-1 grid-cols-1 gap-[10px] min-[1041px]:grid-cols-2">
        {children}
      </div>
    </section>
  );
}
