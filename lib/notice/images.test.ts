import { describe, expect, it } from "vitest";

import {
  applyUploadedNoticeImages,
  buildNoticeImagePath,
  collectNoticeImagePaths,
  collectPendingNoticeImageIds,
  hasNoticeImageNode,
  isNoticeImagePath,
  selectNoticeImageFiles,
} from "./images";
import type { NoticeDoc } from "./richText";

describe("isNoticeImagePath (신뢰 경계)", () => {
  it("공지 이미지 object path 형태만 허용한다", () => {
    expect(isNoticeImagePath("9/notice/abc/uuid-file.png")).toBe(true);
    expect(isNoticeImagePath("9/notice/7/uuid-file.png")).toBe(true);
  });

  it("외부 URL·data:·상대경로·다른 entity는 차단한다", () => {
    expect(isNoticeImagePath("https://evil.example/x.png")).toBe(false);
    expect(isNoticeImagePath("data:image/png;base64,AAAA")).toBe(false);
    expect(isNoticeImagePath("/9/notice/a/b.png")).toBe(false);
    expect(isNoticeImagePath("9/building-vendor/7/a.png")).toBe(false);
    expect(isNoticeImagePath("9/notice/a")).toBe(false);
    expect(isNoticeImagePath(null)).toBe(false);
    expect(isNoticeImagePath(123)).toBe(false);
  });

  it("orgId를 주면 첫 세그먼트 불일치(교차 org)를 차단한다", () => {
    expect(isNoticeImagePath("9/notice/a/b.png", 9)).toBe(true);
    expect(isNoticeImagePath("9/notice/a/b.png", 10)).toBe(false);
  });
});

describe("buildNoticeImagePath", () => {
  it("orgId/notice/.../... 형태를 만들고 스스로 통과한다", () => {
    const path = buildNoticeImagePath({ orgId: 42, fileName: "사진 파일.PNG" });
    expect(path.startsWith("42/notice/")).toBe(true);
    expect(isNoticeImagePath(path, 42)).toBe(true);
    // 파일명은 정규화된다(확장자 소문자).
    expect(path.endsWith(".png")).toBe(true);
  });
});

describe("collect helpers", () => {
  const doc: NoticeDoc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "본문" }] },
      { type: "image", attrs: { path: "9/notice/a/x.png", alt: "저장됨" } },
      { type: "image", attrs: { pendingId: "pend-1", alt: "대기" } },
      { type: "image", attrs: { path: "9/notice/a/x.png", alt: "중복" } },
    ],
  };

  it("저장된 이미지 path만 중복 없이 모은다", () => {
    expect(collectNoticeImagePaths(doc)).toEqual(["9/notice/a/x.png"]);
  });

  it("업로드 전 pendingId만 모은다", () => {
    expect(collectPendingNoticeImageIds(doc)).toEqual(["pend-1"]);
  });

  it("이미지 노드 존재를 판정한다", () => {
    expect(hasNoticeImageNode(doc)).toBe(true);
    expect(hasNoticeImageNode({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
  });
});

describe("applyUploadedNoticeImages", () => {
  const doc: NoticeDoc = {
    type: "doc",
    content: [
      { type: "image", attrs: { pendingId: "ok", alt: "성공" } },
      { type: "image", attrs: { pendingId: "fail", alt: "실패" } },
      { type: "image", attrs: { path: "9/notice/a/keep.png", alt: "유지" } },
    ],
  };

  it("성공한 pending은 path로 치환하고 pendingId를 제거한다", () => {
    const next = applyUploadedNoticeImages(doc, new Map([["ok", "9/notice/b/new.png"]]));
    const images = (next.content ?? []).filter((node) => node.type === "image");
    // 해석되지 않은(fail) pending 노드는 제거되어 2개만 남는다.
    expect(images).toHaveLength(2);
    expect(images[0].attrs).toEqual({ alt: "성공", path: "9/notice/b/new.png" });
    expect(images[0].attrs).not.toHaveProperty("pendingId");
    expect(images[1].attrs).toEqual({ path: "9/notice/a/keep.png", alt: "유지" });
  });

  it("해석되지 않은 pending 노드도 제거해 blob 전용 노드를 저장하지 않는다", () => {
    const next = applyUploadedNoticeImages(doc, new Map());
    const images = (next.content ?? []).filter((node) => node.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].attrs?.path).toBe("9/notice/a/keep.png");
  });
});

describe("selectNoticeImageFiles", () => {
  const image = (name: string) => new File(["x"], name, { type: "image/png" });

  it("이미 있는 이미지 수를 반영해 최대 10장으로 제한한다", () => {
    const { accepted, errors } = selectNoticeImageFiles(9, [image("a.png"), image("b.png")]);
    expect(accepted).toHaveLength(1);
    expect(errors.some((message) => message.includes("최대 10장"))).toBe(true);
  });

  it("허용하지 않는 형식은 거른다", () => {
    const gif = new File(["x"], "a.gif", { type: "image/gif" });
    const { accepted, errors } = selectNoticeImageFiles(0, [gif]);
    expect(accepted).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
