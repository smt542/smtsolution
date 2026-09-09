"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import { byteLen, smsProduct } from "@/lib/messenger/bytes";
import { insertToken, SMS_VARS } from "@/lib/messenger/tokens";
import styles from "./messenger.module.css";

interface MessageComposerProps {
  body: string;
  onBody: (body: string) => void;
  templateId: number | null;
  onTemplate: (templateId: number | null) => void;
}

export function MessageComposer({
  body,
  onBody,
  templateId,
  onTemplate,
}: MessageComposerProps) {
  const { data: templates = [], isLoading } = useMessageTemplates();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState<
    { left: number; top: number; width: number } | undefined
  >();
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bytes = byteLen(body);
  const product = smsProduct(bytes);

  const smsTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.channelType === "sms" &&
          !template.alimtalkTemplateCode &&
          (!search.trim() ||
            `${template.title} ${template.body}`
              .toLocaleLowerCase("ko-KR")
              .includes(search.trim().toLocaleLowerCase("ko-KR"))),
      ),
    [search, templates],
  );

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggleTemplates = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      setMenuPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: rect.bottom + 6,
        width,
      });
    }
    setOpen((current) => !current);
  };

  const chooseTemplate = (id: number) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    onTemplate(template.id);
    onBody(template.body);
    setOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const addVariable = (label: string) => {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? body.length;
    const next = insertToken(body, caret, label);
    onBody(next.body);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className={styles["fmp-smswrap"]}>
      <div
        className={styles["fmp-lbl"]}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>메시지 내용</span>
        <div
          ref={rootRef}
          className={`${styles["fmp-tplsel"]} ${open ? styles.open : ""}`}
        >
          <button
            type="button"
            onClick={toggleTemplates}
            aria-expanded={open}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            템플릿
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div
            className={`${styles.menu} ${styles["fmp-tplmenu"]}`}
            style={menuPosition}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles["fmp-fromadd"]}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="템플릿 검색"
                aria-label="문자 템플릿 검색"
              />
            </div>
            <div className={styles["fmp-tpllist"]}>
              {isLoading && (
                <div className={styles["fmp-pempty"]}>템플릿을 불러오는 중입니다.</div>
              )}
              {!isLoading && smsTemplates.length === 0 && (
                <div className={styles["fmp-pempty"]}>
                  {search.trim() ? "검색 결과가 없어요" : "저장된 문자 템플릿이 없어요"}
                </div>
              )}
              {smsTemplates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={`${styles["fmp-fromrow"]} ${template.id === templateId ? styles.on : ""}`}
                  onClick={() => chooseTemplate(template.id)}
                >
                  <span style={{ minWidth: 0, textAlign: "left" }}>
                    <span className={styles.num}>{template.title}</span>
                    <span className={styles.who} style={{ display: "block" }}>
                      {template.body.replace(/\s+/g, " ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className={styles["fmp-ta"]}
        value={body}
        onChange={(event) => {
          onTemplate(null);
          onBody(event.target.value);
        }}
        placeholder="메시지 내용을 입력해 주세요 · 아래 변수를 눌러 넣을 수 있어요"
        aria-label="문자 메시지 내용"
      />
      <div className={styles["fmp-varsrow"]}>
        <div className={styles["fmp-vars"]} aria-label="메시지 변수">
          {SMS_VARS.map((label) => (
            <button
              type="button"
              key={label}
              className={styles["fmp-var"]}
              onClick={() => addVariable(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles["fmp-bytes"]} aria-live="polite">
          {body.length}자 · {bytes}byte ·{" "}
          <b className={product === "LMS" ? styles.lms : undefined}>{product}</b>
        </div>
      </div>
    </div>
  );
}
