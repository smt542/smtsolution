import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { NOTICE_IMAGE_NODE_TYPE } from "@/lib/notice/images";

import { NoticeImageNodeView } from "./NoticeImageNodeView";

export interface NoticeImageOptions {
  /**
   * 저장 전 새 이미지 File을 담는 공유 맵(pendingId → File).
   * 작성 화면(NoticeFormModal)이 소유해 저장 시 업로드에 사용하고,
   * NodeView는 pending 미리보기(blob URL)에 사용한다.
   */
  pendingFiles: Map<string, File>;
}

export interface NoticeImageStorage {
  pendingFiles: Map<string, File>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noticeImage: {
      /** 선택한 이미지들을 pending 노드로 삽입한다(업로드는 저장 시점에 수행). */
      insertNoticeImages: (files: readonly File[]) => ReturnType;
    };
  }
}

/**
 * 공지 본문용 커스텀 image 노드.
 *
 * - `path`(저장된 object path) 또는 `pendingId`(저장 전 File 참조) 중 하나를 가진다.
 * - 저장 JSON에는 `path`/`alt`만 남는다(`pendingId`는 저장 직전 업로드로 치환·제거).
 * - 표시는 React NodeView가 담당한다: pending은 blob, 저장본은 signed URL(staff RLS).
 */
export const NoticeImage = Node.create<NoticeImageOptions, NoticeImageStorage>({
  name: NOTICE_IMAGE_NODE_TYPE,
  group: "block",
  inline: false,
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { pendingFiles: new Map<string, File>() };
  },

  addStorage() {
    return { pendingFiles: this.options.pendingFiles };
  },

  addAttributes() {
    return {
      path: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-path"),
        renderHTML: (attributes) =>
          attributes.path ? { "data-path": attributes.path } : {},
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
      // 편집 중에만 쓰는 임시 참조. HTML로는 렌더하지 않고, 저장 직전 제거한다.
      pendingId: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-path]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoticeImageNodeView);
  },

  addCommands() {
    const nodeName = this.name;
    return {
      insertNoticeImages:
        (files) =>
        ({ editor, commands }) => {
          if (files.length === 0) return false;
          const storage = (editor.storage as unknown as Record<string, NoticeImageStorage>)[nodeName];
          const nodes = files.map((file) => {
            const pendingId = crypto.randomUUID();
            storage.pendingFiles.set(pendingId, file);
            return { type: nodeName, attrs: { pendingId, alt: file.name } };
          });
          return commands.insertContent(nodes);
        },
    };
  },
});
