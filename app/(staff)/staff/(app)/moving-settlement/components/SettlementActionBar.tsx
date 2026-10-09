import { PrinterIcon } from "@/components/icons";

export function SettlementActionBar({
  onSave,
  onMidMoveout,
  onMoveout,
  onPrint,
  onBlankPrint,
  onDelete,
  pending = false,
  pendingAction = null,
  locked = false,
}: {
  onSave: () => void;
  onMidMoveout: () => void;
  onMoveout: () => void;
  onPrint: () => void;
  onBlankPrint: () => void;
  onDelete: () => void;
  pending?: boolean;
  pendingAction?: "save" | "mid" | "moveout" | "delete" | null;
  /** 완료(중도퇴실·퇴실완료) 건: 저장·완료·삭제 잠금, 출력·빈양식만 허용(정책 3.12). */
  locked?: boolean;
}) {
  const neutral =
    "flex h-[40px] items-center justify-center gap-[6px] rounded-[11px] border border-line bg-white px-[10px] text-[13.5px] font-bold text-t2 hover:bg-bg disabled:cursor-wait disabled:opacity-60";
  const outlined =
    "h-[40px] rounded-[11px] border border-teal bg-white px-[10px] text-[13.5px] font-bold text-teal-d hover:bg-teal-t disabled:cursor-wait disabled:opacity-60";

  return (
    // pr-[72px]: 우하단 메신저 FAB(right-22 · 52px)에 버튼이 가리지 않도록 원본이 비워 둔 여백
    <div className="flex h-[62px] shrink-0 items-center gap-[8px] rounded-[14px] border border-line bg-white py-[10px] pl-[14px] pr-[72px]">
      <button
        type="button"
        onClick={onSave}
        disabled={pending || locked}
        className="flex-[1_1_auto] min-w-max justify-center h-[40px] rounded-[11px] border border-transparent bg-teal px-[10px] text-[13.5px] font-bold text-white shadow-pri hover:bg-teal-d disabled:cursor-wait disabled:opacity-60"
      >
        저장
      </button>
      <button type="button" onClick={onMidMoveout} disabled={pending || locked} className={`${outlined} flex-[1_1_auto] min-w-max justify-center`}>
        {pendingAction === "mid" ? "중도퇴실 처리 중…" : "정산완료+중도퇴실"}
      </button>
      <button type="button" onClick={onMoveout} disabled={pending || locked} className={`${outlined} flex-[1_1_auto] min-w-max justify-center`}>
        {pendingAction === "moveout" ? "퇴실 처리 중…" : "정산완료+퇴실"}
      </button>
      <button type="button" onClick={onPrint} disabled={pending} className={`${neutral} flex-[1_1_auto] min-w-max justify-center`}>
        <PrinterIcon className="size-[16px]" /> 출력
      </button>
      <button type="button" onClick={onBlankPrint} disabled={pending} className={`${neutral} flex-[1_1_auto] min-w-max justify-center`}>
        <PrinterIcon className="size-[16px]" /> 빈양식
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending || locked}
        className="flex-[1_1_auto] min-w-max justify-center h-[40px] rounded-[11px] border border-red bg-white px-[10px] text-[13.5px] font-bold text-red hover:bg-red-t disabled:cursor-wait disabled:opacity-60"
      >
        {pendingAction === "delete" ? "삭제 중…" : "삭제"}
      </button>
    </div>
  );
}
