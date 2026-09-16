"use client";

import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates/apis";
import {
  buildRecipientRenderVariables,
  type MessageRecipient,
} from "@/lib/messaging/preset";
import { messengerClasses as styles } from "./messengerClasses";
import type { ChannelMode } from "./types";

interface PhonePreviewProps {
  channel: ChannelMode;
  body: string;
  sampleRecipient?: MessageRecipient | null;
  template?: MessageTemplate | null;
  sender?: string;
}

const DEFAULT_SAMPLE: MessageRecipient = {
  name: "김민준",
  phone: "010-1111-2222",
  unitNo: "101호",
  kind: "tenant",
  variables: {
    건물명: "그린빌라",
    입주자명: "김민준",
    호실: "101호",
    호수: "101",
    건물주명: "홍길동",
    청소담당자명: "문청소",
  },
};

function ResolvedBody({
  body,
  variables,
}: {
  body: string;
  variables: Record<string, string>;
}) {
  const parts = body.split(/(#?\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, index) => {
        const token = part.match(/^#?\{([^}]+)\}$/);
        if (!token) return part;
        const name = token[1].trim();
        if (!Object.prototype.hasOwnProperty.call(variables, name)) return part;
        return <b key={`${name}-${index}`}>{variables[name]}</b>;
      })}
    </>
  );
}

function EmptyPreview() {
  return (
    <div className={styles["ph-empty"]}>
      <div className={styles["ph-empty-ic"]}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
        </svg>
      </div>
      메시지를 입력하면{"\n"}이렇게 도착해요
    </div>
  );
}

export function PhonePreview({
  channel,
  body,
  sampleRecipient,
  template,
  sender,
}: PhonePreviewProps) {
  const recipient = sampleRecipient ?? DEFAULT_SAMPLE;
  const variables = buildRecipientRenderVariables(
    recipient,
    undefined,
    recipient.variables?.건물명,
  );
  const previewBody = channel === "alim" ? (template?.body ?? body) : body;
  const empty = !previewBody.trim() || (channel === "alim" && !template);

  return (
    <div className={styles["fmp-phonewrap"]}>
      {/* 정본: 메시지 컬럼 라벨과 높이를 맞추기 위한 숨김 스페이서(표시 안 함) */}
      <div
        className={styles["fmp-lbl"]}
        aria-hidden="true"
        style={{ visibility: "hidden", height: 25 }}
      >
        미리보기
      </div>
      <div className={styles["fmp-phone"]}>
        <div className={styles["ph-screen"]}>
          <div className={styles["ph-head"]}>
            <span className={styles["ph-from"]}>
              {channel === "alim"
                ? "관리비서 채널"
                : `발신 ${sender?.trim() || "번호 미지정"}`}
            </span>
            <span
              className={`${styles["ph-ch"]} ${channel === "alim" ? styles.alim : styles.sms}`}
            >
              {channel === "alim" ? "알림톡" : "문자"}
            </span>
          </div>
          {empty ? (
            <EmptyPreview />
          ) : (
            <>
              <div className={styles["ph-daysep"]}>오늘</div>
              {channel === "alim" ? (
                <div className={`${styles["ph-bubble"]} ${styles.kakao}`}>
                  <div className={styles["ph-ak-head"]}>알림톡 도착</div>
                  <div className={styles["ph-ak-body"]}>
                    <ResolvedBody body={previewBody} variables={variables} />
                  </div>
                  {template?.buttons[0] && (
                    <div className={styles["ph-akbtn"]}>
                      {template.buttons[0].name}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`${styles["ph-bubble"]} ${styles.sms}`}>
                  <ResolvedBody body={previewBody} variables={variables} />
                </div>
              )}
              <div className={styles["ph-time"]}>방금 전</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
