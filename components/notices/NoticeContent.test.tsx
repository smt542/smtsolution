import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NoticeDoc } from "@/lib/notice/richText";

import { NoticeContent } from "./NoticeContent";

const richDoc: NoticeDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "제목" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "굵게" },
        { type: "text", text: " 그리고 " },
        { type: "text", marks: [{ type: "italic" }], text: "기울임" },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "항목" }] }] },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "link", attrs: { href: "https://example.com" } }], text: "안전 링크" },
      ],
    },
  ],
};

describe("NoticeContent (읽기 전용 렌더러)", () => {
  it("Tiptap JSON을 시맨틱 리치 텍스트로 렌더한다", () => {
    const { container } = render(<NoticeContent json={richDoc} />);
    expect(container.querySelector("h2")?.textContent).toBe("제목");
    expect(container.querySelector("strong")?.textContent).toBe("굵게");
    expect(container.querySelector("em")?.textContent).toBe("기울임");
    expect(container.querySelectorAll("ul li")).toHaveLength(1);
  });

  it("허용 링크는 href와 안전한 target/rel로 렌더한다", () => {
    render(<NoticeContent json={richDoc} />);
    const link = screen.getByRole("link", { name: "안전 링크" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("위험한 링크 스킴은 href 없이 텍스트만 남긴다", () => {
    const doc: NoticeDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }], text: "위험" },
          ],
        },
      ],
    };
    const { container } = render(<NoticeContent json={doc} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("위험");
  });

  it("json이 없으면 레거시 평문을 줄바꿈을 보존해 표시한다", () => {
    const { container } = render(<NoticeContent fallbackText={"첫째 줄\n둘째 줄"} />);
    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).toBe("첫째 줄\n둘째 줄");
  });

  const imageDoc: NoticeDoc = {
    type: "doc",
    content: [
      { type: "image", attrs: { path: "9/notice/a/x.png", alt: "안내 이미지" } },
      { type: "image", attrs: { path: "9/notice/b/y.png", alt: "미해석 이미지" } },
    ],
  };

  it("이미지 노드는 해석된 signed URL로 렌더하고, 미해석은 대체 표시로 남긴다", () => {
    const { container } = render(
      <NoticeContent json={imageDoc} imageUrls={{ "9/notice/a/x.png": "https://signed/x" }} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://signed/x");
    expect(img).toHaveAttribute("alt", "안내 이미지");
    // 서명 실패/누락 이미지는 object path를 노출하지 않고 대체 표시만 남는다.
    expect(screen.getByRole("img", { name: "미해석 이미지" })).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("9/notice/b/y.png");
  });

  it("이미지 URL을 아직 해석 중이면 로딩 상태를 표시한다", () => {
    render(<NoticeContent json={imageDoc} imageUrls={{}} imageUrlsLoading />);
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("이미지 불러오는 중").length).toBe(2);
  });
});
