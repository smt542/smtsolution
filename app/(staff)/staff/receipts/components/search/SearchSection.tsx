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
    <section className="rounded-xl bg-bg p-[13px]">
      <div className="mb-[19px] flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-[7px]">
          <span className="h-[14px] w-[3px] shrink-0 rounded-[2px] bg-[#14a497]" aria-hidden />
          <h3 className="whitespace-nowrap text-[13.5px] font-extrabold tracking-[-0.27px] text-t1">
            {title}
          </h3>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">{actions}</div>
      </div>
      <div className="flex flex-col gap-[10px] md:flex-row">{children}</div>
    </section>
  );
}
