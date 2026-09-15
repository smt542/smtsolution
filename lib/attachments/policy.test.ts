import { describe, expect, it } from "vitest";
import {
  buildAttachmentStoragePath,
  normalizeAttachmentFileName,
  selectImageFiles,
  validateAttachmentFile,
} from "./policy";

describe("attachment policy", () => {
  it("이미지 MIME과 10MB 제한을 검증한다", () => {
    const pdf = new File(["pdf"], "contract.pdf", { type: "application/pdf" });
    const tooLarge = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(tooLarge, "size", { value: 10 * 1024 * 1024 + 1 });

    expect(validateAttachmentFile(pdf, "image")).toContain("JPG");
    expect(validateAttachmentFile(tooLarge, "image")).toContain("10MB");
    expect(validateAttachmentFile(pdf, "document")).toBeNull();
  });

  it("유효한 파일만 남기고 최대 개수를 적용한다", () => {
    const current = Array.from({ length: 9 }, (_, index) =>
      new File([`${index}`], `${index}.png`, { type: "image/png" }),
    );
    const selected = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.webp", { type: "image/webp" }),
      new File(["c"], "c.gif", { type: "image/gif" }),
    ];

    const result = selectImageFiles(current, selected, 10);
    expect(result.accepted.map((file) => file.name)).toEqual(["a.jpg"]);
    expect(result.errors.join(" ")).toContain("c.gif");
    expect(result.errors.join(" ")).toContain("최대 10장");
  });

  it("파일명과 경로 세그먼트를 한 규칙으로 정규화한다", () => {
    expect(normalizeAttachmentFileName("../한글 계약서 FINAL.PNG")).toBe("FINAL.png");
    expect(buildAttachmentStoragePath({
      orgId: 9,
      entityType: "building/vendor",
      entityId: 7,
      fileName: "계약서 사진.JPG",
      uniqueId: "fixed-id",
    })).toBe("9/building-vendor/7/fixed-id-file.jpg");
  });
});
