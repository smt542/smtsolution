"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Textarea } from "@/components/common";
import { SearchIcon } from "@/components/icons";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import { byteLen, smsProduct } from "@/lib/messenger/bytes";
import { messengerClasses as styles } from "./messengerClasses";

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
  const { data: templates = [], isLoading, isFetching, isError } = useMessageTemplates();
  const isTemplateListRefreshing = isFetching && !isLoading;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPosition, setMenuPosition] = useState<
    { left: number; top: number; width: number; maxHeight: number } | undefined
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
        maxHeight: Math.max(336, Math.min(360, window.innerHeight - rect.bottom - 16)),
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

  return (
    <>
      <div
        className={`${styles["fmp-lbl"]} flex items-center justify-between`}
        // 정본은 라벨이 .fmp-smswrap 밖(fmp-msgL 형제)이라 margin8+gap8=16px 간격.
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
            className="inline-flex items-center gap-[5px] whitespace-nowrap"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-none"
            >
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            템플릿
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
              className="flex-none"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div
            className={`menu ${styles.menu} ${styles["fmp-tplmenu"]}`}
            style={menuPosition}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative mb-[4px] flex items-center border-b border-line2 px-[2px] pb-[8px] pt-[2px]">
              <SearchIcon className="pointer-events-none absolute left-[11px] size-[14px] text-t3" />
              <Input
                unstyled
                className="h-[34px] w-full rounded-[8px] border border-line bg-white pl-[30px] pr-[10px] text-[12.5px] font-semibold text-t1 outline-none focus:border-blue"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="템플릿 검색"
                aria-label="문자 템플릿 검색"
              />
            </div>
            <div className={`${styles["fmp-tpllist"]} max-h-[270px]`}>
              {isLoading && (
                <div className={styles["fmp-pempty"]} role="status" aria-label="문자 템플릿 불러오는 중">템플릿을 불러오는 중입니다.</div>
              )}
              {isError && (
                <div className={styles["fmp-pempty"]} role="alert">문자 템플릿을 불러오지 못했습니다.</div>
              )}
              {isTemplateListRefreshing && (
                <div className={styles["fmp-pempty"]} role="status" aria-label="문자 템플릿 갱신 중">템플릿을 갱신하는 중입니다.</div>
              )}
              {!isLoading && !isError && smsTemplates.length === 0 && (
                <div className={styles["fmp-pempty"]}>
                  {search.trim() ? "검색 결과가 없어요" : "저장된 문자 템플릿이 없어요"}
                </div>
              )}
              {!isError && smsTemplates.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={`flex w-full cursor-pointer items-start gap-[8px] rounded-[9px] px-[10px] py-[9px] text-left hover:bg-bg ${template.id === templateId ? "bg-blue-t2" : ""}`}
                  onClick={() => chooseTemplate(template.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-bold ${template.id === templateId ? "text-blue-d" : "text-t1"}`}>
                      {template.title}
                    </span>
                    <span className="mt-[2px] block truncate text-[11.5px] font-medium text-t3">
                      {template.body.replace(/\s+/g, " ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles["fmp-smswrap"]}>
        <Textarea
          unstyled
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
          <div className={styles["fmp-bytes"]} aria-live="polite">
            {body.length}자 · {bytes}byte ·{" "}
            <b className={product === "LMS" ? styles.lms : undefined}>{product}</b>
          </div>
        </div>
      </div>
    </>
  );
}
