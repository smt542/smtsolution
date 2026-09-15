"use client";

import { useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";

import { isNoticeAllowedHref, type NoticeDoc } from "@/lib/notice/richText";

import { noticeEditorExtensions } from "./tiptap/noticeExtensions";
import sharedStyles from "./noticeRichText.module.css";
import styles from "./NoticeEditor.module.css";

type NoticeEditorProps = {
  value: NoticeDoc;
  onChange: (doc: NoticeDoc) => void;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

/**
 * 공지 작성/수정용 Tiptap 편집기(작성 화면 전용 client component).
 *
 * - `immediatelyRender: false`로 Next.js SSR/hydration 불일치를 피한다.
 * - 최소 toolbar(문단·제목·굵게·기울임·목록·인용·링크·실행취소/다시실행)만 노출한다.
 * - 링크는 허용 스킴(http/https/mailto/tel)만 넣을 수 있다.
 */
export function NoticeEditor({
  value,
  onChange,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: NoticeEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const invalid = ariaInvalid === true || ariaInvalid === "true";

  const editor = useEditor({
    extensions: noticeEditorExtensions,
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${sharedStyles.root} ${styles.editable}`,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel ?? "공지 내용",
        ...(invalid ? { "aria-invalid": "true" } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            isH2: instance.isActive("heading", { level: 2 }),
            isH3: instance.isActive("heading", { level: 3 }),
            isBold: instance.isActive("bold"),
            isItalic: instance.isActive("italic"),
            isBullet: instance.isActive("bulletList"),
            isOrdered: instance.isActive("orderedList"),
            isQuote: instance.isActive("blockquote"),
            isLink: instance.isActive("link"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : null,
  });

  const openLink = () => {
    const prev = editor?.getAttributes("link")?.href;
    setLinkValue(typeof prev === "string" ? prev : "");
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkValue.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isNoticeAllowedHref(url)) {
      setLinkError("http, https, mailto, tel 링크만 넣을 수 있어요.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  const button = (
    label: string,
    active: boolean,
    disabled: boolean,
    onClick: () => void,
    content: ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={`${styles.tb} ${active ? styles.tbActive : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {content}
    </button>
  );

  const ready = Boolean(editor) && Boolean(state);

  return (
    <div className={`${styles.wrap} ${invalid ? styles.invalid : ""}`}>
      <div className={styles.toolbar} role="toolbar" aria-label="공지 서식">
        {button("문단", false, !ready, () => editor?.chain().focus().setParagraph().run(), "문단")}
        {button("제목 1", Boolean(state?.isH2), !ready, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), "제목1")}
        {button("제목 2", Boolean(state?.isH3), !ready, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), "제목2")}
        <span className={styles.divider} aria-hidden="true" />
        {button("굵게", Boolean(state?.isBold), !ready, () => editor?.chain().focus().toggleBold().run(), <b>B</b>)}
        {button("기울임", Boolean(state?.isItalic), !ready, () => editor?.chain().focus().toggleItalic().run(), <i>I</i>)}
        <span className={styles.divider} aria-hidden="true" />
        {button("글머리 목록", Boolean(state?.isBullet), !ready, () => editor?.chain().focus().toggleBulletList().run(), "•")}
        {button("번호 목록", Boolean(state?.isOrdered), !ready, () => editor?.chain().focus().toggleOrderedList().run(), "1.")}
        {button("인용", Boolean(state?.isQuote), !ready, () => editor?.chain().focus().toggleBlockquote().run(), "❝")}
        {button("링크", Boolean(state?.isLink), !ready, openLink, "링크")}
        <span className={styles.divider} aria-hidden="true" />
        {button("실행 취소", false, !ready || !state?.canUndo, () => editor?.chain().focus().undo().run(), "↶")}
        {button("다시 실행", false, !ready || !state?.canRedo, () => editor?.chain().focus().redo().run(), "↷")}
      </div>

      <EditorContent editor={editor} />

      {linkOpen && (
        <div className={styles.linkbar}>
          <input
            type="url"
            inputMode="url"
            aria-label="링크 주소"
            placeholder="https://example.com"
            className={styles.linkInput}
            value={linkValue}
            onChange={(event) => {
              setLinkValue(event.target.value);
              if (linkError) setLinkError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <button type="button" className={`${styles.linkBtn} ${styles.linkBtnPrimary}`} onClick={applyLink}>
            적용
          </button>
          {state?.isLink && (
            <button type="button" className={styles.linkBtn} onClick={removeLink}>
              제거
            </button>
          )}
          <button type="button" className={styles.linkBtn} onClick={() => setLinkOpen(false)}>
            취소
          </button>
          {linkError && <p className={styles.linkError} role="alert">{linkError}</p>}
        </div>
      )}
    </div>
  );
}
