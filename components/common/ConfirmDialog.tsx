"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

export type ConfirmVariant = "default" | "danger";
export type ConfirmLook = "default" | "check" | "plain" | "split" | "left" | "hq" | "hqCompact";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  look?: ConfirmLook;
  hideCancel?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  variant = "default",
  look = "default",
  hideCancel = false,
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
  widthClassName = "w-[min(400px,92%)]",
  titleSpacingClassName = "mb-2",
}: ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
  widthClassName?: string;
  /** plain look 제목 아래 간격. 정본은 문구형 8px, 선택형(퇴실 처리 안내) 6px이다. */
  titleSpacingClassName?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // 파괴적 확인은 취소 버튼에 포커스(오작동 방지), 그 외 확인 버튼에 포커스
    (hideCancel ? confirmRef : variant === "danger" ? cancelRef : confirmRef).current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [hideCancel, onCancel, open, variant]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red text-white hover:bg-[#d93c49]"
      : "bg-blue text-white hover:bg-blue-d";

  if (look === "hq") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className="max-h-[88vh] w-[min(400px,90%)] overflow-auto rounded-[20px] bg-white p-6 text-left leading-[normal] shadow-hf-modal"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="text-[16.5px] font-extrabold tracking-[-0.02em] text-t1">
            {title}
          </h2>
          {description != null && (
            <p id={descId} className="mt-2 whitespace-pre-line text-[13.5px] font-semibold leading-[1.6] text-t3">
              {description}
            </p>
          )}
          {children}
          <div className="mt-5 flex gap-2">
            <div className="flex-1" />
            {!hideCancel && (
              <Button
                type="button"
                size="std"
                variant="ghost"
                onClick={onCancel}
                autoFocus={variant === "danger"}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="button"
              size="std"
              variant={variant === "danger" ? "danger" : "primary"}
              className={variant === "danger" ? "shadow-none" : ""}
              onClick={onConfirm}
              autoFocus={hideCancel || variant !== "danger"}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (look === "hqCompact") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className="max-h-[88vh] w-[min(400px,90vw)] overflow-auto rounded-[18px] bg-white px-6 pb-[18px] pt-[22px] text-left leading-[normal] shadow-[0_24px_60px_-20px_rgba(23,31,40,0.4)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="text-[16px] font-extrabold tracking-[-0.02em] text-t1">
            {title}
          </h2>
          {description != null && (
            <p
              id={descId}
              className="mt-2 whitespace-pre-line text-[13px] font-medium leading-[1.6] text-t3 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
            >
              {description}
            </p>
          )}
          {children}
          <div className="mt-5 flex justify-end gap-2">
            {!hideCancel && (
              <Button
                type="button"
                size="std"
                variant="ghost"
                onClick={onCancel}
                autoFocus={variant === "danger"}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="button"
              size="std"
              variant={variant === "danger" ? "danger" : "primary"}
              className={variant === "danger" ? "shadow-none" : ""}
              onClick={onConfirm}
              autoFocus={hideCancel || variant !== "danger"}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (look === "plain") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className={`max-h-[88vh] overflow-auto rounded-[20px] bg-white p-6 text-left shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)] ${widthClassName}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className={`${titleSpacingClassName} text-[17px] font-extrabold text-t1`}>
            {title}
          </h2>
          {description != null && (
            <p
              id={descId}
              className="whitespace-pre-line text-[13.5px] font-semibold leading-[1.6] text-t2 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
            >
              {description}
            </p>
          )}
          {children}
          <div className="mt-[18px] flex justify-end gap-[8px]">
            {!hideCancel && (
              <Button
                type="button"
                size="std"
                variant="ghost"
                onClick={onCancel}
                autoFocus={variant === "danger" && !hideCancel}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="button"
              size="std"
              variant={variant === "danger" ? "danger" : "primary"}
              className={variant === "danger" ? "shadow-none hover:bg-red" : ""}
              onClick={onConfirm}
              autoFocus={hideCancel || variant !== "danger"}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 정본 메시징 예약 취소(#cxScrim): `.modal` 문구형 + `.fmpc-btn` 두 버튼이 줄을 반씩 채운다.
  if (look === "split") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className={`max-h-[88vh] overflow-auto rounded-[20px] bg-white p-6 text-left leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)] ${widthClassName}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="mb-[6px] text-[17px] font-extrabold text-t1">
            {title}
          </h2>
          {description != null && (
            <p
              id={descId}
              className="whitespace-pre-line text-[13.5px] font-medium leading-[1.6] text-t3 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
            >
              {description}
            </p>
          )}
          {children}
          <div className="mt-[22px] flex justify-end gap-[8px]">
            {!hideCancel && (
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] bg-bg px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:bg-line2"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-white disabled:opacity-60 ${variant === "danger" ? "bg-red" : "bg-blue hover:bg-blue-d"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 정본 계정 삭제(#rgDel): 기본 `.fmpc` 카드를 폭 380·왼쪽 정렬로 덮어쓴 문구형.
  // 두 버튼이 줄을 반씩 채우고, hover는 둘 다 밝기 .97(`.fmpc-btn:hover`)이다.
  if (look === "left") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className="max-h-[88vh] w-[min(380px,92%)] overflow-auto rounded-[20px] bg-white px-[26px] pb-6 pt-7 text-left leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="mb-2 text-[16px] font-extrabold text-t1">
            {title}
          </h2>
          {description != null && (
            <p
              id={descId}
              className="whitespace-pre-line text-[13.5px] font-medium leading-[1.65] text-t2 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
            >
              {description}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            {!hideCancel && (
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] bg-bg px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:brightness-[.97]"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
              className={`flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-white hover:brightness-[.97] disabled:opacity-60 ${variant === "danger" ? "bg-red" : "bg-blue"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (look === "check") {
    return (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
        onMouseDown={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description != null ? descId : undefined}
          className="max-h-[88vh] w-[min(400px,92%)] overflow-auto rounded-[20px] bg-white px-[26px] pb-6 pt-7 text-left leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-[9px]">
            <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-blue-t">
              <svg
                className="size-[19px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-blue)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </div>
            <h2 id={titleId} className="text-[16px] font-extrabold text-t1">
              {title}
            </h2>
          </div>
          {description != null && (
            <p
              id={descId}
              className="whitespace-pre-line text-[13.5px] font-medium leading-[1.65] text-t2 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
            >
              {description}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="flex h-10 flex-1 items-center justify-center rounded-[11px] border border-line bg-white px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:bg-bg"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className="flex h-10 flex-1 items-center justify-center rounded-[11px] border border-blue bg-blue px-[18px] text-[13.5px] font-bold tracking-[-0.01em] text-white shadow-none hover:bg-blue-d"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      /* 확인 대화상자는 항상 최상단이어야 한다. 앱의 모달·드로어가 z-110~520을 쓰므로
         그보다 위에 둔다(z-100이던 동안에는 모달 안에서 띄운 확인창이 뒤에 가려졌다). */
      className="fixed inset-0 z-[600] flex items-center justify-center bg-scrim p-6"
      onMouseDown={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descId : undefined}
        className="max-h-[88vh] w-[min(360px,92%)] overflow-auto rounded-[20px] bg-white px-[26px] pb-6 pt-7 text-center shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-[17px] font-extrabold tracking-[-0.02em] text-t1">
          {title}
        </h2>
        {description != null && (
          <p
            id={descId}
            className="mt-2 whitespace-pre-line text-[13.5px] font-semibold leading-[1.6] text-t3 [&_b]:font-bold [&_b]:text-t1 [&_strong]:font-bold [&_strong]:text-t1"
          >
            {description}
          </p>
        )}
        <div className="mt-[26px] flex gap-[9px]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] bg-bg text-[13.5px] font-bold tracking-[-0.01em] text-t2 hover:bg-line2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex h-10 flex-1 items-center justify-center gap-[7px] rounded-[11px] text-[13.5px] font-bold tracking-[-0.01em] ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
