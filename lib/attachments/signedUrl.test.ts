import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

import { createPrivateAssetSignedUrl, signedUrlOptions } from "./signedUrl";

beforeEach(() => {
  vi.clearAllMocks();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "signed" }, error: null });
});

describe("private asset signed URLs", () => {
  it("Free 환경에서는 thumbnail도 원본 signed URL로 fallback한다", async () => {
    await createPrivateAssetSignedUrl({
      bucket: "attachments",
      path: "1/photo.jpg",
      preset: "thumbnail",
      mimeType: "image/jpeg",
      transformationsEnabled: false,
    });

    expect(createSignedUrl).toHaveBeenCalledWith("1/photo.jpg", 3600);
  });

  it("활성 환경의 이미지에만 preset transform을 전달한다", async () => {
    await createPrivateAssetSignedUrl({
      bucket: "attachments",
      path: "1/photo.jpg",
      preset: "preview",
      mimeType: "image/jpeg",
      transformationsEnabled: true,
    });

    expect(createSignedUrl).toHaveBeenCalledWith("1/photo.jpg", 3600, {
      transform: { width: 1280, height: 1280, resize: "contain", quality: 80 },
    });
    expect(signedUrlOptions({
      preset: "thumbnail",
      mimeType: "application/pdf",
      transformationsEnabled: true,
    })).toBeUndefined();
  });
});
