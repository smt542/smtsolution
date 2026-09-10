"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates/apis";
import styles from "./messenger.module.css";

export const AUTO_VARS = new Set([
  "링크토큰",
  "상세링크",
  "공지ID",
  "이름",
  "건물명",
  "호실",
  "호수",
  "세대",
  "입주자명",
  "건물주명",
  "청소담당자명",
  "고객번호",
  "건물코드+입주자코드",
  "관리비기간",
  "관리비 정산 기간",
  "청구월",
  "납기일",
  "관리비 납부 기한일",
  "출금예정일",
  "당월관리비",
  "당월 총 관리비",
  "청구금액",
  "미납관리비",
  "이전 미납 관리비 총액",
  "미납금액",
  "미납월",
  "총납부금액",
  "총 납부해야할 금액",
  "납부계좌",
  "관리실연락처",
  "관리실 번호",
  "관리사무소연락처",
  "금액",
  "년",
  "월",
  "년도",
]);

interface TemplateWithStatus extends MessageTemplate {
  status?: string | null;
  approvalStatus?: string | null;
  alimtalkStatus?: string | null;
}

interface AlimtalkFormProps {
  templateId: number | null;
  onTemplate: (templateId: number | null) => void;
  vars: Record<string, string>;
  onVars: (vars: Record<string, string>) => void;
}

export function extractAlimtalkVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/#?\{([^}]+)\}/g)) {
    const name = match[1].trim();
    if (name) found.add(name);
  }
  return [...found];
}

function isApproved(template: TemplateWithStatus): boolean {
  const rawStatus =
    template.status ?? template.approvalStatus ?? template.alimtalkStatus;
  if (!rawStatus) return Boolean(template.alimtalkTemplateCode);
  return ["approved", "approve", "ok", "active", "승인", "승인완료"].includes(
    rawStatus.toLocaleLowerCase(),
  );
}

function templateKind(template: MessageTemplate): "recurring" | "notice" {
  return ["bill", "overdue", "recurring", "정기"].includes(
    template.category ?? "",
  )
    ? "recurring"
    : "notice";
}

function TokenizedBody({ body }: { body: string }) {
  const parts = body.split(/(#?\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, index) =>
        /^#?\{[^}]+\}$/.test(part) ? (
          <span className={styles["ak-tok"]} key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function AlimtalkForm({
  templateId,
  onTemplate,
  vars,
  onVars,
}: AlimtalkFormProps) {
  const { data: allTemplates = [], isLoading } = useMessageTemplates();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const templates = useMemo(
    () =>
      allTemplates.filter(
        (template) =>
          template.channelType === "alimtalk" &&
          Boolean(template.alimtalkTemplateCode),
      ) as TemplateWithStatus[],
    [allTemplates],
  );
  const selected = templates.find((template) => template.id === templateId) ?? null;
  const manualVariables = selected
    ? extractAlimtalkVariables(selected.body).filter((name) => !AUTO_VARS.has(name))
    : [];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const chooseTemplate = (template: TemplateWithStatus) => {
    if (!isApproved(template)) return;
    const nextVariables = Object.fromEntries(
      extractAlimtalkVariables(template.body)
        .filter((name) => !AUTO_VARS.has(name))
        .map((name) => [name, ""]),
    );
    onTemplate(template.id);
    onVars(nextVariables);
    setOpen(false);
  };

  const kind = selected ? templateKind(selected) : "notice";

  return (
    <div className={styles["fmp-akwrap"]} style={{ display: "flex" }}>
      <div className={styles["fmp-lbl"]}>알림톡 승인 템플릿</div>
      <div
        ref={rootRef}
        className={`${styles["fmp-aksel"]} ${open ? styles.open : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.k}>K</span>
        {selected ? (
          <span className={styles.nm}>{selected.title}</span>
        ) : (
          <span className={styles.phv}>승인 템플릿을 선택해 주세요</span>
        )}
        <svg
          className={styles.cv}
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="#8B95A1"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <div
          className={styles["fmp-akmenu"]}
          onClick={(event) => event.stopPropagation()}
        >
          {isLoading && (
            <div className={styles["fmp-pempty"]}>템플릿을 불러오는 중입니다.</div>
          )}
          {!isLoading && templates.length === 0 && (
            <div className={styles["fmp-pempty"]}>
              승인 코드가 등록된 알림톡 템플릿이 없습니다.
            </div>
          )}
          {templates.map((template) => {
            const approved = isApproved(template);
            const optionKind = templateKind(template);
            return (
              <button
                type="button"
                key={template.id}
                className={`${styles["ak-opt"]} ${!approved ? styles.disabled : ""}`}
                onClick={() => chooseTemplate(template)}
                disabled={!approved}
              >
                <span className={styles["ak-opt-h"]}>
                  <span className={`${styles["ak-type"]} ${styles[optionKind]}`}>
                    {optionKind === "recurring" ? "정기" : "공지"}
                  </span>
                  <span className={styles.nm}>{template.title}</span>
                  <span
                    className={`${styles["ak-status"]} ${approved ? styles.ok : styles.wait}`}
                  >
                    {approved ? "승인" : "미승인"}
                  </span>
                </span>
                <span className={styles["ak-opt-b"]}>
                  {template.body.replace(/\s+/g, " ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles["fmp-akform"]} style={{ display: "flex" }}>
        {!selected ? (
          <div className={styles["ak-emptyhint"]}>
            위 <b>템플릿</b>에서 승인 템플릿을 선택하면
            <br />채워 넣을 항목이 여기에 표시돼요.
          </div>
        ) : (
          <>
            <div className={styles["ak-fhead"]}>
              <span className={`${styles["ak-type"]} ${styles[kind]}`}>
                {kind === "recurring" ? "정기" : "공지"}
              </span>
              <span className={styles["ak-fname"]}>{selected.title}</span>
            </div>
            <div className={styles["ak-readonly"]}>
              <div className={styles["ak-ro-lbl"]}>템플릿 내용</div>
              <div className={styles["ak-ro-body"]}>
                <TokenizedBody body={selected.body} />
              </div>
            </div>
            {manualVariables.length > 0 && (
              <div className={styles["ak-vars"]}>
                {manualVariables.map((name) => (
                  <div className={styles["ak-vrow"]} key={name}>
                    <label htmlFor={`messenger-alim-${name}`}>{name}</label>
                    <input
                      id={`messenger-alim-${name}`}
                      value={vars[name] ?? ""}
                      placeholder={`${name} 입력`}
                      onChange={(event) =>
                        onVars({ ...vars, [name]: event.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <div className={styles["fmp-akhint"]}>
              수신자 정보 변수는 각 대상의 데이터로 자동 입력됩니다.
            </div>
            {selected.buttons[0] && (
              <div className={styles["ak-btnbox"]}>
                <div className={styles["ak-btnlbl"]}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
                    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  버튼
                </div>
                <div className={styles["ak-btnview"]}>
                  <b>{selected.buttons[0].name}</b>
                  <i>{selected.buttons[0].url || "템플릿에 설정된 링크"}</i>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
