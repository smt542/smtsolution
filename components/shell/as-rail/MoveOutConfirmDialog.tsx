import { createPortal } from "react-dom";
import { Modal } from "@/components/common";
import type { StaffMoveOutRequest } from "@/hooks/reactquery/staffMoveOut/apis";
import { moveOutUnitTitle } from "./constants";

interface MoveOutConfirmDialogProps {
  request: StaffMoveOutRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}

export function MoveOutConfirmDialog({
  request,
  onCancel,
  onConfirm,
  pending,
}: MoveOutConfirmDialogProps) {
  if (request === null) return null;

  // 우측 패널은 translate 로 여닫는 fixed 요소라 그 안의 fixed 모달이 패널 크기에 갇힌다 →
  // body 로 포탈해 정본 `.mvq-scrim`(화면 전체·z-index 800)처럼 가운데에 띄운다.
  return createPortal(
    <Modal
      open
      onClose={onCancel}
      title="퇴실 신청을 처리 완료할까요?"
      overlayClassName="z-[800]"
      className="w-[min(400px,92%)] rounded-[20px] pt-[24px] px-[24px] pb-[20px] text-left shadow-hf-modal [&>h2]:text-[17px] [&>h2]:leading-[normal] [&>h2]:mb-2 [&>div]:mt-0"
    >
      <div className="text-[13.5px] font-medium text-t2 leading-[1.65] [&_b]:font-bold [&_b]:text-t1">
        <b>{moveOutUnitTitle(request)}</b> 퇴실 신청을 목록에서 정리해요.
        <br />
        처리 완료해도 정산은 자동으로 되지 않습니다.{" "}
        <b>반드시 이사정산을 진행해 주세요.</b>
      </div>
      <div className="flex gap-2 justify-end mt-[22px]">
        <button
          type="button"
          className="h-10 px-[18px] rounded-[11px] inline-flex items-center justify-center text-[13.5px] font-bold cursor-pointer bg-bg text-t2"
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="button"
          className="h-10 px-[18px] rounded-[11px] inline-flex items-center justify-center text-[13.5px] font-bold cursor-pointer bg-blue text-white"
          onClick={onConfirm}
          disabled={pending}
        >
          처리 완료
        </button>
      </div>
    </Modal>,
    document.body,
  );
}
