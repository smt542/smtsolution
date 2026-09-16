"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { TenantForm } from "../[id]/components/TenantForm";

/** 입주민 행에서 여는 세대별 관리카드 모달. 출력 모달과는 독립적으로 동작한다. */
export function TenantManagementCardModal({
  buildingId,
  unitId,
  onClose,
}: {
  buildingId: number;
  unitId: number;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [dirty, setDirty] = useState(false);

  const requestClose = useCallback(async () => {
    if (dirty) {
      const ok = await confirm({ title: "저장하지 않고 닫기", description: "저장하지 않고 닫으시겠습니까?", confirmLabel: "닫기" });
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose, confirm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [requestClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-[20px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="입주민 관리카드"
        className="h-[min(880px,calc(100vh-40px))] w-[min(1240px,calc(100vw-40px))] overflow-y-auto rounded-[22px] bg-[#f4f6f7] p-[22px] shadow-[0px_40px_90px_-24px_rgba(0,0,0,0.5)]"
      >
        <TenantForm
          buildingId={buildingId}
          unitId={unitId}
          presentation="modal"
          onClose={requestClose}
          onDirtyChange={setDirty}
        />
      </section>
    </div>
  );
}
