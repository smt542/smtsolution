"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";

import { useAppToast } from "@/hooks/common";
import { isNoticeAllowedHref, type NoticeDoc } from "@/lib/notice/richText";
import {
  IMAGE_ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_FILES,
} from "@/lib/attachments/policy";
import { NOTICE_IMAGE_NODE_TYPE, selectNoticeImageFiles } from "@/lib/notice/images";

import { createNoticeEditorExtensions } from "./tiptap/noticeExtensions";
import { noticeRichTextClassName } from "./richTextClasses";

type NoticeEditorProps = {
  value: NoticeDoc;
  onChange: (doc: NoticeDoc) => void;
  /** 저장 전 새 이미지 File을 담는 공유 맵. 작성 화면이 소유해 저장 시 업로드에 쓴다. */
  pendingFiles: Map<string, File>;
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
  pendingFiles,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: NoticeEditorProps) {
  const appToast = useAppToast();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const invalid = ariaInvalid === true || ariaInvalid === "true";

  const extensions = useMemo(
    () => createNoticeEditorExtensions({ pendingFiles }),
    [pendingFiles],
  );

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${noticeRichTextClassName} min-h-[180px] max-h-[420px] overflow-y-auto px-3.5 py-3 outline-none`,
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

  const countImages = () => {
    let count = 0;
    editor?.state.doc.descendants((node) => {
      if (node.type.name === NOTICE_IMAGE_NODE_TYPE) count += 1;
    });
    return count;
  };

  const addImages = (fileList: FileList | null) => {
    if (!editor || !fileList) return;
    const { accepted, errors } = selectNoticeImageFiles(countImages(), Array.from(fileList));
    if (errors.length > 0) appToast.error(errors.join("\n"));
    if (accepted.length > 0) editor.chain().focus().insertNoticeImages(accepted).run();
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
      className={`inline-flex h-[30px] min-w-8 items-center justify-center rounded-lg bg-transparent px-2 text-xs font-bold text-t2 hover:bg-bg disabled:cursor-default disabled:opacity-40 ${active ? "bg-brand text-white hover:bg-brand" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {content}
    </button>
  );

  const ready = Boolean(editor) && Boolean(state);

  return (
    <div className={`rounded-in border bg-surface ${invalid ? "border-danger" : "border-line"} focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(20,164,151,0.12)]`}>
      <div className="flex flex-wrap gap-1 border-b border-line p-1.5" role="toolbar" aria-label="공지 서식">
        {button("문단", false, !ready, () => editor?.chain().focus().setParagraph().run(), "문단")}
        {button("제목 1", Boolean(state?.isH2), !ready, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), "제목1")}
        {button("제목 2", Boolean(state?.isH3), !ready, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), "제목2")}
        <span className="my-0.5 w-px self-stretch bg-line" aria-hidden="true" />
        {button("굵게", Boolean(state?.isBold), !ready, () => editor?.chain().focus().toggleBold().run(), <b>B</b>)}
        {button("기울임", Boolean(state?.isItalic), !ready, () => editor?.chain().focus().toggleItalic().run(), <i>I</i>)}
        <span className="my-0.5 w-px self-stretch bg-line" aria-hidden="true" />
        {button("글머리 목록", Boolean(state?.isBullet), !ready, () => editor?.chain().focus().toggleBulletList().run(), "•")}
        {button("번호 목록", Boolean(state?.isOrdered), !ready, () => editor?.chain().focus().toggleOrderedList().run(), "1.")}
        {button("인용", Boolean(state?.isQuote), !ready, () => editor?.chain().focus().toggleBlockquote().run(), "❝")}
        {button("링크", Boolean(state?.isLink), !ready, openLink, "링크")}
        {button("이미지", false, !ready, () => imageInputRef.current?.click(), "이미지")}
        <span className="my-0.5 w-px self-stretch bg-line" aria-hidden="true" />
        {button("실행 취소", false, !ready || !state?.canUndo, () => editor?.chain().focus().undo().run(), "↶")}
        {button("다시 실행", false, !ready || !state?.canRedo, () => editor?.chain().focus().redo().run(), "↷")}
      </div>

      <EditorContent editor={editor} />

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ATTACHMENT_ACCEPT}
        multiple={MAX_ATTACHMENT_FILES > 1}
        hidden
        aria-label="본문 이미지 선택"
        onChange={(event) => {
          addImages(event.target.files);
          event.target.value = "";
        }}
      />

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line p-2">
          <input
            type="url"
            inputMode="url"
            aria-label="링크 주소"
            placeholder="https://example.com"
            className="h-8 min-w-0 flex-[1_1_200px] rounded-lg border border-line px-2.5 text-[13px] outline-none focus:border-brand"
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
          <button type="button" className="h-8 rounded-lg bg-brand px-3 text-[13px] font-bold text-white" onClick={applyLink}>
            적용
          </button>
          {state?.isLink && (
            <button type="button" className="h-8 rounded-lg bg-bg px-3 text-[13px] font-bold text-t2" onClick={removeLink}>
              제거
            </button>
          )}
          <button type="button" className="h-8 rounded-lg bg-bg px-3 text-[13px] font-bold text-t2" onClick={() => setLinkOpen(false)}>
            취소
          </button>
          {linkError && <p className="m-0 basis-full text-xs text-danger" role="alert">{linkError}</p>}
        </div>
      )}
    </div>
  );
}
