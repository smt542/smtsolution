import Image from "next/image";

interface OverdueEmptyStateProps {
  title: string;
  description: string;
}

export function OverdueEmptyState({ title, description }: OverdueEmptyStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[5px] px-[24px] pb-[52px] pt-[44px] text-center">
      <div className="mb-[4px] flex size-[56px] items-center justify-center rounded-[17px] bg-[#e2f5f1]">
        <Image src="/icons/overdue/calendar.svg" alt="" width={27} height={27} className="size-[27px]" />
      </div>
      {/* 정본은 line-height 를 선언하지 않아 `normal`(≈1.2)이다. 생략하면 Tailwind
          기본 1.5 가 걸려 제목이 ~5px 높아지고 아래 설명문이 그만큼 밀린다. */}
      <p className="text-[16px] font-bold leading-[normal] tracking-[-0.32px] text-t1">{title}</p>
      <p className="text-[13.5px] font-normal leading-[21.6px] text-t3">{description}</p>
    </div>
  );
}
