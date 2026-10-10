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
  completedLocked = locked,
}: {
  onSave: () => void;
  onMidMoveout: () => void;
  onMoveout: () => void;
  onPrint: () => void;
  onBlankPrint: () => void;
  onDelete: () => void;
  pending?: boolean;
  pendingAction?: "save" | "mid" | "moveout" | "delete" | null;
  /** 완료(중도퇴실·퇴실완료) 건: 중도퇴실·삭제 잠금(정책 3.12). */
  locked?: boolean;
  /** 퇴실완료 건만 잠금(저장·퇴실). 중도퇴실 건은 값을 고쳐 저장하고 「정산완료+퇴실」로 완전 퇴실할 수 있어야 한다. */
  completedLocked?: boolean;
}) {
  // 처리 중일 때만 대기 커서. 잠긴(완료) 버튼에 대기 커서가 뜨면 계속 처리 중인 것처럼 보인다.
  const disabledCursor = pending ? "disabled:cursor-wait" : "disabled:cursor-not-allowed";
  const neutral =
    `flex h-[40px] items-center justify-center gap-[6px] rounded-[11px] border border-line bg-white px-[10px] text-[13.5px] font-bold text-t2 hover:bg-bg ${disabledCursor} disabled:opacity-60`;
  const outlined =
    `h-[40px] rounded-[11px] border border-teal bg-white px-[10px] text-[13.5px] font-bold text-teal-d hover:bg-teal-t ${disabledCursor} disabled:opacity-60`;

  return (
    // pr-[72px]: 우하단 메신저 FAB(right-22 · 52px)에 버튼이 가리지 않도록 원본이 비워 둔 여백
    <div className="flex h-[62px] shrink-0 items-center gap-[8px] rounded-[14px] border border-line bg-white py-[10px] pl-[14px] pr-[72px]">
      <button
        type="button"
        onClick={onSave}
        disabled={pending || completedLocked}
        className={`flex-[1_1_auto] min-w-max justify-center h-[40px] rounded-[11px] border border-transparent bg-teal px-[10px] text-[13.5px] font-bold text-white shadow-pri hover:bg-teal-d ${disabledCursor} disabled:opacity-60`}
      >
        저장
      </button>
      <button type="button" onClick={onMidMoveout} disabled={pending || locked} className={`${outlined} flex-[1_1_auto] min-w-max justify-center`}>
        {pendingAction === "mid" ? "중도퇴실 처리 중…" : "정산완료+중도퇴실"}
      </button>
      <button type="button" onClick={onMoveout} disabled={pending || completedLocked} className={`${outlined} flex-[1_1_auto] min-w-max justify-center`}>
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
        className={`flex-[1_1_auto] min-w-max justify-center h-[40px] rounded-[11px] border border-red bg-white px-[10px] text-[13.5px] font-bold text-red hover:bg-red-t ${disabledCursor} disabled:opacity-60`}
      >
        {pendingAction === "delete" ? "삭제 중…" : "삭제"}
      </button>
    </div>
  );
}
