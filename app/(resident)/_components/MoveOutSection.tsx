"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  moveOutCreateSchema,
  moveOutUpdateSchema,
  type MoveOutCreateInput,
  type MoveOutCreateValues,
  type MoveOutUpdateInput,
  type MoveOutUpdateValues,
} from "@/components/forms/schema/residentMoveOut";
import {
  useCancelMoveOut,
  useCreateMoveOut,
  useMoveOutRequest,
  useUpdateMoveOut,
} from "@/hooks/reactquery/residentMoveOut";
import { formatDate } from "@/lib/format";

import { moveOutClasses as styles } from "./moveOutClasses";

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
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCreated, setShowCreated] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const createForm = useForm<MoveOutCreateInput, unknown, MoveOutCreateValues>({
    resolver: zodResolver(moveOutCreateSchema),
    defaultValues: { desiredDate: "", reason: "" },
    shouldFocusError: true,
  });
  const updateForm = useForm<MoveOutUpdateInput, unknown, MoveOutUpdateValues>({
    resolver: zodResolver(moveOutUpdateSchema),
    defaultValues: { desiredDate: "" },
    shouldFocusError: true,
  });

  const isMoveOutFormPending = createMutation.isPending
    || updateMutation.isPending
    || cancelMutation.isPending
    || createForm.formState.isSubmitting
    || updateForm.formState.isSubmitting;
  const isMoveOutRequestSubmitting = createMutation.isPending || createForm.formState.isSubmitting;
  const isMoveOutUpdateSubmitting = updateMutation.isPending || updateForm.formState.isSubmitting;
  const closeSafely = () => {
    if (isMoveOutFormPending) return;
    createForm.reset({ desiredDate: "", reason: "" });
    updateForm.reset({ desiredDate: "" });
    setEditing(false);
    setShowCancelWarning(false);
    setActionError(null);
    setActionMessage(null);
    onClose();
  };

  const createRequest = async (values: MoveOutCreateValues) => {
    setActionError(null);
    setActionMessage(null);

    try {
      await createMutation.mutateAsync(values);
      createForm.reset({ desiredDate: "", reason: "" });
      setShowCreated(true);
      setShowNewForm(false);
    } catch (error) {
      const refreshed = await requestQuery.refetch();
      if (refreshed.data?.status === "pending") {
        createForm.reset({ desiredDate: "", reason: "" });
        setShowNewForm(false);
        return;
      }
      setSubmissionError(error, createForm.setError, "퇴실 신청을 접수하지 못했어요.");
    }
  };

  const updateRequest = async (values: MoveOutUpdateValues) => {
    setActionError(null);
    setActionMessage(null);
    try {
      await updateMutation.mutateAsync(values.desiredDate);
      updateForm.reset({ desiredDate: "" });
      setEditing(false);
      setActionMessage("희망 퇴실일을 변경했어요.");
    } catch (error) {
      setSubmissionError(error, updateForm.setError, "희망 퇴실일을 변경하지 못했어요.");
    }
  };

  const cancelRequest = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      await cancelMutation.mutateAsync();
      setShowCancelWarning(false);
      setActionMessage("퇴실 신청을 취소했어요.");
    } catch (error) {
      setShowCancelWarning(false);
      setActionError(
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
      onDismiss={closeSafely}
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
        <form className={styles.form} onSubmit={createForm.handleSubmit(createRequest)} noValidate>
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
              id="move-out-desired-date"
              type="date"
              {...createForm.register("desiredDate")}
              aria-invalid={Boolean(createForm.formState.errors.desiredDate)}
              aria-describedby={createForm.formState.errors.desiredDate ? "move-out-desired-date-error" : undefined}
            />
            {createForm.formState.errors.desiredDate?.message && (
              <small id="move-out-desired-date-error" className={styles.error}>{createForm.formState.errors.desiredDate.message}</small>
            )}
          </label>
          <label>
            <span>사유 <small>선택</small></span>
            <textarea
              id="move-out-reason"
              rows={3}
              placeholder="퇴실 사유를 입력해 주세요."
              {...createForm.register("reason")}
              aria-invalid={Boolean(createForm.formState.errors.reason)}
              aria-describedby={createForm.formState.errors.reason ? "move-out-reason-error" : undefined}
            />
            {createForm.formState.errors.reason?.message && (
              <small id="move-out-reason-error" className={styles.error}>{createForm.formState.errors.reason.message}</small>
            )}
          </label>
          {createForm.formState.errors.root?.server?.message && (
            <p className={styles.error} role="alert">{createForm.formState.errors.root.server.message}</p>
          )}
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isMoveOutRequestSubmitting}
          >
            {isMoveOutRequestSubmitting ? "퇴실 신청 중…" : "퇴실 신청하기"}
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
            <form className={styles.editForm} onSubmit={updateForm.handleSubmit(updateRequest)} noValidate>
              <label>
                <span>새 희망 퇴실일</span>
                <input
                  id="move-out-edit-date"
                  type="date"
                  {...updateForm.register("desiredDate")}
                  aria-invalid={Boolean(updateForm.formState.errors.desiredDate)}
                  aria-describedby={updateForm.formState.errors.desiredDate ? "move-out-edit-date-error" : undefined}
                />
                {updateForm.formState.errors.desiredDate?.message && (
                  <small id="move-out-edit-date-error" className={styles.error}>{updateForm.formState.errors.desiredDate.message}</small>
                )}
              </label>
              {updateForm.formState.errors.root?.server?.message && (
                <p className={styles.error} role="alert">{updateForm.formState.errors.root.server.message}</p>
              )}
              <div className={styles.actionRow}>
                <button type="submit" disabled={isMoveOutUpdateSubmitting}>
                  {isMoveOutUpdateSubmitting ? "퇴실 신청 변경 중…" : "변경 저장"}
                </button>
                <button type="button" disabled={isMoveOutFormPending} onClick={() => setEditing(false)}>
                  닫기
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={() => {
                  updateForm.reset({ desiredDate: request.desiredDate });
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
                createForm.reset({ desiredDate: "", reason: "" });
                setShowNewForm(true);
              }}
            >
              다시 신청하기
            </button>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p className={styles.error} role="alert">
          {actionError}
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
              <button type="button" disabled={cancelMutation.isPending} onClick={() => setShowCancelWarning(false)}>
                돌아가기
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={cancelMutation.isPending}
                onClick={() => void cancelRequest()}
              >
                {cancelMutation.isPending ? "신청 취소 중…" : "신청 취소"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ResidentBottomSheet>
  );
}
