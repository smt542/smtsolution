"use client";

import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates/apis";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { byteLen, smsProduct } from "@/lib/messenger/bytes";
import { AUTO_VARS, extractAlimtalkVariables } from "./AlimtalkForm";
import { formatScheduledAt } from "./SchedulePicker";
import styles from "./messenger.module.css";
import type { ChannelMode } from "./types";

interface SendSummaryDialogProps {
  recipients: MessageRecipient[];
  channel: ChannelMode;
  body: string;
  templateId: number | null;
  scheduledAt: string | null;
  recurrenceMode: "monthly" | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  sender?: string;
  template?: MessageTemplate | null;
  vars?: Record<string, string>;
  estimatedPoints?: number | null;
  excludedCount?: number;
  disabledReason?: string | null;
  isSending?: boolean;
}

function formatPoints(points: number): string {
  return new Intl.NumberFormat("ko-KR").format(points);
}

function unresolvedVariables(
  body: string,
  recipients: MessageRecipient[],
  vars: Record<string, string>,
): string[] {
  return extractAlimtalkVariables(body).filter((name) => {
    if (AUTO_VARS.has(name)) return false;
    if (vars[name]?.trim()) return false;
    return !recipients.some((recipient) => recipient.variables?.[name]?.trim());
  });
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

export function SendSummaryDialog({
  recipients,
  channel,
  body,
  templateId,
  scheduledAt,
  recurrenceMode,
  onCancel,
  onConfirm,
  sender,
  template,
  vars = {},
  estimatedPoints,
  excludedCount = 0,
  disabledReason,
  isSending = false,
}: SendSummaryDialogProps) {
  const bytes = byteLen(body);
  const product = smsProduct(bytes);
  const unresolved = unresolvedVariables(body, recipients, vars);
  const warning =
    disabledReason ||
    (!body.trim()
      ? "메시지 내용이 비어 있어요."
      : channel === "alim" && templateId === null
        ? "알림톡 승인 템플릿을 선택해 주세요."
        : unresolved.length > 0
          ? `${unresolved.map((name) => `#{${name}}`).join(", ")} 값을 입력해 주세요.`
          : null);

  return (
    <div
      className={`${styles["fmpc-scrim"]} ${styles.show}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSending) onCancel();
      }}
    >
      <div
        className={styles.fmpc}
        style={{ width: "min(410px, 90%)" }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="messenger-summary-title"
      >
        <div className={styles["fmpc-t"]} id="messenger-summary-title">
          이대로 발송할까요?
        </div>
        <div className={styles["fmp-sum"]}>
          <div className={styles.r}>
            <span className={styles.rl}>채널</span>
            <span className={styles.rv}>
              <span className={styles["ch-pill"]}>
                {channel === "alim" ? "알림톡" : "문자"}
              </span>
            </span>
          </div>
          <div className={styles.r}>
            <span className={styles.rl}>{channel === "alim" ? "채널" : "발신번호"}</span>
            <span className={styles.rv}>
              {channel === "alim" ? "관리비서 채널" : sender?.trim() || "운영사 기본번호"}
            </span>
          </div>
          <div className={styles.r}>
            <span className={styles.rl}>수신자</span>
            <span className={styles.rv}>
              {recipients.length}명
              {excludedCount > 0 ? ` · 알림톡 미동의 ${excludedCount}명 제외` : ""}
            </span>
          </div>
          <div className={styles.r}>
            <span className={styles.rl}>발송시점</span>
            <span className={styles.rv}>
              {formatScheduledAt(scheduledAt)}
              {recurrenceMode === "monthly" && (
                <> · <span className={styles["ch-pill"]}>매월 반복</span></>
              )}
            </span>
          </div>
          {channel === "sms" ? (
            <div className={styles.r}>
              <span className={styles.rl}>유형</span>
              <span className={styles.rv}>
                {product} · {bytes}byte
              </span>
            </div>
          ) : (
            <div className={styles.r}>
              <span className={styles.rl}>템플릿</span>
              <span className={styles.rv}>{template?.title ?? "선택 안 됨"}</span>
            </div>
          )}
          {estimatedPoints !== null && estimatedPoints !== undefined && (
            <div className={styles.r}>
              <span className={styles.rl}>예상 포인트</span>
              <span className={styles.rv}>{formatPoints(estimatedPoints)} P</span>
            </div>
          )}
        </div>

        {warning && (
          <div className={styles["fmp-sum-warn"]} role="alert">
            <WarningIcon />
            <span>{warning}</span>
          </div>
        )}

        <div
          className={styles["dt-lbl"]}
          style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
        >
          수신자 목록
          <span style={{ fontWeight: 700 }}>{recipients.length}명</span>
        </div>
        <div className={styles["dt-list"]}>
          {recipients.map((recipient, index) => (
            <span key={`${recipient.kind}-${recipient.phone ?? ""}-${index}`}>
              <b>{recipient.name ?? "이름 미등록"}</b>
              <i>
                {recipient.unitNo && (
                  <>
                    <em>{recipient.unitNo}</em>
                    <br />
                  </>
                )}
                {recipient.phone ?? "연락처 없음"}
              </i>
            </span>
          ))}
          {recipients.length === 0 && (
            <span className={styles.more}>발송 가능한 수신자가 없습니다.</span>
          )}
        </div>

        <div className={styles["dt-lbl"]} style={{ marginTop: 12 }}>
          전송 내용
        </div>
        <div className={styles["dt-msg"]}>{body}</div>

        <div className={styles["fmpc-btns"]} style={{ marginTop: 20 }}>
          <button
            type="button"
            className={`${styles["fmpc-btn"]} ${styles.cancel}`}
            onClick={onCancel}
            disabled={isSending}
          >
            취소
          </button>
          <button
            type="button"
            className={`${styles["fmpc-btn"]} ${styles.go}`}
            onClick={() => void onConfirm()}
            disabled={Boolean(warning) || recipients.length === 0 || isSending}
            style={{ opacity: warning || recipients.length === 0 ? 0.45 : undefined }}
          >
            {isSending ? "발송 중…" : scheduledAt ? "예약 발송" : "발송"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CloseConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={`${styles["fmpc-scrim"]} ${styles.show}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className={styles.fmpc}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="messenger-close-title"
      >
        <div className={styles["fmpc-ic"]}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
        </div>
        <div className={styles["fmpc-t"]} id="messenger-close-title">
          작성 중인 내용을 닫을까요?
        </div>
        <div className={styles["fmpc-d"]}>
          닫으면 지금까지 입력한 수신자·내용이 사라져요.
        </div>
        <div className={styles["fmpc-btns"]}>
          <button
            type="button"
            className={`${styles["fmpc-btn"]} ${styles.cancel}`}
            onClick={onCancel}
          >
            계속 작성
          </button>
          <button
            type="button"
            className={`${styles["fmpc-btn"]} ${styles.danger}`}
            onClick={onConfirm}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
