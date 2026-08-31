"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MenuIcon } from "@/components/icons";

/** Figma 상단 헤더 바 (673:55645): 브레드크럼 + 제목 + 뒤로가기/등록 저장. */
export function RegisterHeader() {
  const router = useRouter();
  return (
    <div className="flex h-[62px] items-center gap-[12px] border-b border-line bg-surface px-[24px]">
      <div className="flex shrink-0 items-start pr-[2px]">
        <div className="flex size-[36px] items-center justify-center rounded-[10px]">
          <MenuIcon variant="building-register" className="size-[20px] text-t2" />
        </div>
      </div>
      <div className="flex flex-col">
        <p className="text-[12px] font-semibold text-t3">건물·입주자 관리</p>
        <p className="text-[19px] font-extrabold tracking-[-0.38px] text-t1">건물 등록</p>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => router.push("/staff/buildings")}
        className="flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
      >
        뒤로가기
      </button>
      <button
        type="button"
        onClick={() => toast("미리보기 화면입니다 — 저장 배선은 후속 작업입니다")}
        className="flex h-[40px] items-center rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white shadow-[0px_6px_7px_rgba(20,164,151,0.5)] hover:bg-teal-d"
      >
        등록 저장
      </button>
    </div>
  );
}
