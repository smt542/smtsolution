import { Modal } from "@/components/common";
import type { StaffMoveOutRequest } from "@/hooks/reactquery/staffMoveOut/apis";

import styles from "./AsRail.module.css";

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
      className={styles.mvq}
    >
      <div className={styles.mvqD}>
        <b>{request?.tenantName ?? "-"}</b> 퇴실 신청을 목록에서 정리해요.
        <br />
        처리 완료해도 정산은 자동으로 되지 않습니다.{" "}
        <b>반드시 이사정산을 진행해 주세요.</b>
      </div>
      <div className={styles.mvqF}>
        <button
          type="button"
          className={`${styles.mvqB} ${styles.mvqCancel}`}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="button"
          className={`${styles.mvqB} ${styles.mvqPrimary}`}
          onClick={onConfirm}
          disabled={pending}
        >
          처리 완료
        </button>
      </div>
    </Modal>
  );
}
