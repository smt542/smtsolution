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
      <p className="text-[16px] font-bold tracking-[-0.32px] text-t1">{title}</p>
      <p className="text-[13.5px] leading-[21.6px] text-t3">{description}</p>
    </div>
  );
}
