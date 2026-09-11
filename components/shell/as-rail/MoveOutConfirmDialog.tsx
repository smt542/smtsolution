import { Modal } from "@/components/common";
import type { StaffMoveOutRequest } from "@/hooks/reactquery/staffMoveOut/apis";

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
  return (
    <Modal
      open={request !== null}
      onClose={onCancel}
      title="퇴실 신청을 처리 완료할까요?"
      className="w-[min(400px,92%)] rounded-[20px] pt-[24px] px-[24px] pb-[20px] text-left shadow-hf-modal [&>h2]:text-[17px] [&>h2]:mb-2 [&>div]:mt-0"
    >
      <div className="text-[13.5px] font-medium text-t2 leading-[1.65] [&_b]:font-bold [&_b]:text-t1">
        <b>{request?.tenantName ?? "-"}</b> 퇴실 신청을 목록에서 정리해요.
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
    </Modal>
  );
}
