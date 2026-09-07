"use client";

import { type FormEvent, useState } from "react";

import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import {
  useCancelMoveOut,
  useCreateMoveOut,
  useMoveOutRequest,
  useUpdateMoveOut,
} from "@/hooks/reactquery/residentMoveOut";
import { formatDate } from "@/lib/format";

import styles from "./MoveOutSection.module.css";

type MoveOutSectionProps = {
  open: boolean;
  onClose: () => void;
};

const statusCopy = {
  confirmed: {
    title: "퇴실 일정이 확정됐어요",
    description: "관리업체에서 확정한 일정에 맞춰 안내해 드릴게요.",
  },
  canceled: {
    title: "퇴실 신청이 취소됐어요",
    description: "필요하면 새로운 희망일로 다시 신청할 수 있어요.",
  },
  rejected: {
    title: "퇴실 신청이 반려됐어요",
    description: "관리업체에 확인한 뒤 새로운 희망일로 다시 신청해 주세요.",
  },
} as const;

export default function MoveOutSection({ open, onClose }: MoveOutSectionProps) {
  const requestQuery = useMoveOutRequest();
  const createMutation = useCreateMoveOut();
  const updateMutation = useUpdateMoveOut();
  const cancelMutation = useCancelMoveOut();
  const [desiredDate, setDesiredDate] = useState("");
  const [reason, setReason] = useState("");
  const [editDate, setEditDate] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCreated, setShowCreated] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const createRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!desiredDate) return;
    setFormError(null);
    setActionMessage(null);

    try {
      await createMutation.mutateAsync({
        desiredDate,
        reason: reason.trim() || null,
      });
      setShowCreated(true);
      setShowNewForm(false);
      setReason("");
    } catch (error) {
      const refreshed = await requestQuery.refetch();
      if (refreshed.data?.status === "pending") {
        setShowNewForm(false);
        return;
      }
      setFormError(
        error instanceof Error
          ? error.message
          : "퇴실 신청을 접수하지 못했어요.",
      );
    }
  };

  const updateRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDate) return;
    setFormError(null);
    setActionMessage(null);
    try {
      await updateMutation.mutateAsync(editDate);
      setEditing(false);
      setActionMessage("희망 퇴실일을 변경했어요.");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "희망 퇴실일을 변경하지 못했어요.",
      );
    }
  };

  const cancelRequest = async () => {
    setFormError(null);
    setActionMessage(null);
    try {
      await cancelMutation.mutateAsync();
      setShowCancelWarning(false);
      setActionMessage("퇴실 신청을 취소했어요.");
    } catch (error) {
      setShowCancelWarning(false);
      setFormError(
        error instanceof Error
          ? error.message
          : "퇴실 신청을 취소하지 못했어요.",
      );
    }
  };

  const request = requestQuery.data;
  const canStartAgain =
    request?.status === "canceled" || request?.status === "rejected";
  const showForm = !request || (canStartAgain && showNewForm);

  return (
    <ResidentBottomSheet
      variant="stepped"
      open={open}
      onDismiss={onClose}
    >
      <div className={styles.sheetTitle}>퇴실 신청</div>
      <div className={styles.sheetScroll}>
      {requestQuery.isPending ? (
        <div className={styles.state} role="status">
          퇴실 신청 내역을 확인하고 있어요.
        </div>
      ) : requestQuery.error ? (
        <div className={styles.state} role="alert">
          <b>퇴실 신청 내역을 불러오지 못했어요.</b>
          <button type="button" onClick={() => void requestQuery.refetch()}>
            다시 시도
          </button>
        </div>
      ) : showForm ? (
        <form className={styles.form} onSubmit={createRequest}>
          {canStartAgain ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setShowNewForm(false)}
            >
              이전 신청 상태 보기
            </button>
          ) : null}
          <label>
            <span>희망 퇴실일 <em>필수</em></span>
            <input
              type="date"
              required
              value={desiredDate}
              onChange={(event) => setDesiredDate(event.target.value)}
            />
          </label>
          <label>
            <span>사유 <small>선택</small></span>
            <textarea
              rows={3}
              value={reason}
              placeholder="퇴실 사유를 입력해 주세요."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "신청 중..." : "퇴실 신청하기"}
          </button>
        </form>
      ) : request?.status === "pending" ? (
        <div className={styles.requestCard}>
          <div className={styles.statusIcon} aria-hidden="true">
            ✓
          </div>
          <b>담당자가 확인 중이에요</b>
          <p>확인 후 퇴실 절차를 안내해 드릴게요.</p>
          <dl>
            <div>
              <dt>희망 퇴실일</dt>
              <dd>{formatDate(request.desiredDate)}</dd>
            </div>
          </dl>

          {editing ? (
            <form className={styles.editForm} onSubmit={updateRequest}>
              <label>
                <span>새 희망 퇴실일</span>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                />
              </label>
              <div className={styles.actionRow}>
                <button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "변경 중..." : "변경 저장"}
                </button>
                <button type="button" onClick={() => setEditing(false)}>
                  닫기
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={() => {
                  setEditDate(request.desiredDate);
                  setEditing(true);
                }}
              >
                희망 퇴실일 변경
              </button>
              <button
                type="button"
                className={styles.dangerText}
                onClick={() => setShowCancelWarning(true)}
              >
                신청 취소
              </button>
            </div>
          )}
        </div>
      ) : request ? (
        <div className={styles.requestCard}>
          <b>{statusCopy[request.status].title}</b>
          <p>{statusCopy[request.status].description}</p>
          <dl>
            <div>
              <dt>희망 퇴실일</dt>
              <dd>{formatDate(request.desiredDate)}</dd>
            </div>
          </dl>
          {canStartAgain ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setDesiredDate("");
                setReason("");
                setShowNewForm(true);
              }}
            >
              다시 신청하기
            </button>
          ) : null}
        </div>
      ) : null}

      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      {actionMessage ? (
        <p className={styles.success} role="status">
          {actionMessage}
        </p>
      ) : null}
      </div>

      {showCreated ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="move-out-created-title">
          <div className={styles.modalBody}>
            <div className={styles.modalIcon} aria-hidden="true">✓</div>
            <h3 id="move-out-created-title">퇴실 신청이 접수됐어요</h3>
            <p>담당자가 확인한 뒤 안내해 드릴게요.</p>
            <button type="button" onClick={() => setShowCreated(false)}>
              확인
            </button>
          </div>
        </div>
      ) : null}

      {showCancelWarning ? (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="move-out-cancel-title">
          <div className={styles.modalBody}>
            <h3 id="move-out-cancel-title">퇴실 신청을 취소할까요?</h3>
            <p>취소하면 담당자가 확인 중인 신청이 종료돼요.</p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setShowCancelWarning(false)}>
                돌아가기
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={cancelMutation.isPending}
                onClick={() => void cancelRequest()}
              >
                {cancelMutation.isPending ? "취소 중..." : "신청 취소"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ResidentBottomSheet>
  );
}
