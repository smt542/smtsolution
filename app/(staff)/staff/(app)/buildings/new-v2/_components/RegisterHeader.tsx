"use client";
import { MenuIcon } from "@/components/icons";

/** Figma 상단 헤더 바 (673:55645): 브레드크럼 + 제목 + 뒤로가기/저장. */
export function RegisterHeader({
  title,
  backLabel,
  saveLabel,
  onBack,
  onSave,
  saving,
}: {
  title: string;
  backLabel: string;
  saveLabel: string;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-[62px] items-center gap-[12px] border-b border-line bg-surface px-[24px]">
      <div className="flex shrink-0 items-start pr-[2px]">
        <div className="flex size-[36px] items-center justify-center rounded-[10px]">
          <MenuIcon variant="building-register" className="size-[20px] text-t2" />
        </div>
      </div>
      <div className="flex flex-col">
        <p className="text-[12px] font-semibold text-t3">건물·입주자 관리</p>
        <p className="text-[19px] font-extrabold tracking-[-0.38px] text-t1">{title}</p>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onBack}
        className="flex h-[40px] items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex h-[40px] items-center rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)] hover:bg-teal-d disabled:opacity-60"
      >
        {saving ? "저장 중…" : saveLabel}
      </button>
    </div>
  );
}
