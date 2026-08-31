import { ResidentsIcon } from "@/components/icons";

/** Figma 673:40298 — 건물 미선택 시 입주민 영역 빈 상태. */
export function TenantEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-[6px] px-[24px] pb-[64px] pt-[56px] text-center">
      <span className="mb-[6px] flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-teal-t text-teal">
        <ResidentsIcon className="h-[28px] w-[28px]" aria-hidden="true" />
      </span>
      <p className="text-[16px] font-semibold tracking-[-0.32px] text-t1">건물을 선택해 주세요</p>
      <p className="text-[13.5px] leading-[21px] text-t3">
        위 전체 건물 목록에서 건물을 선택하면
        <br />
        해당 건물의 입주민이 여기에 표시돼요
      </p>
    </div>
  );
}
