"use client";

import Image from "next/image";
import { useEffect } from "react";

interface DeleteBuildingTypeDialogProps {
  open: boolean;
  label: string;
  itemCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteBuildingTypeDialog({
  open,
  label,
  itemCount,
  onClose,
  onConfirm,
}: DeleteBuildingTypeDialogProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171f28]/50 px-4" onMouseDown={onClose}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-building-type-title"
        className="w-full max-w-[400px] -translate-y-[5px] rounded-[20px] bg-white p-6 shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-[10px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-red-t">
            <Image src="/icons/fee-items/warning.svg" alt="" width={22} height={22} />
          </span>
          <h2 id="delete-building-type-title" className="text-[18px] font-extrabold text-t1">유형 삭제</h2>
        </div>
        <p className="mt-[10px] text-[13px] font-semibold leading-5 text-t2">
          <strong className="font-extrabold text-t1">&lsquo;{label}&rsquo;</strong> 유형과 등록된 관리 항목 {itemCount}개가 모두 삭제됩니다. 이 작업은 되돌릴 수 없어요.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className="h-[46px] rounded-[13px] border border-line text-[14px] font-bold text-t2" onClick={onClose}>취소</button>
          <button type="button" className="h-[46px] rounded-[13px] bg-red text-[14px] font-bold text-white shadow-[0_8px_14px_-5px_rgba(240,68,82,.65)]" onClick={onConfirm}>삭제</button>
        </div>
      </section>
    </div>
  );
}
