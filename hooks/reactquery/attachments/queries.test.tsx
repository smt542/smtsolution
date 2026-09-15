import type { PropsWithChildren } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

import { useAttachmentSignedUrls } from "./queries";
import type { Attachment } from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("useAttachmentSignedUrls", () => {
  it("한 항목의 URL 실패가 다른 항목 결과를 가리지 않는다", async () => {
    createSignedUrl.mockImplementation(async (path: string) => path.includes("broken")
      ? { data: null, error: { message: "broken" } }
      : { data: { signedUrl: `signed:${path}` }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const attachments: Attachment[] = [
      { id: 1, orgId: 1, entityType: "vendor", entityId: 2, kind: "contract", fileUrl: "ok.jpg", fileName: "ok.jpg", mimeType: "image/jpeg", sizeBytes: 1, createdAt: "" },
      { id: 2, orgId: 1, entityType: "vendor", entityId: 2, kind: "contract", fileUrl: "broken.jpg", fileName: "broken.jpg", mimeType: "image/jpeg", sizeBytes: 1, createdAt: "" },
    ];

    const { result } = renderHook(
      () => useAttachmentSignedUrls(attachments, "thumbnail"),
      { wrapper },
    );

    await waitFor(
      () => expect(result.current.every((item) => !item.isPending)).toBe(true),
      { timeout: 3_000 },
    );
    expect(result.current[0].url).toBe("signed:ok.jpg");
    expect(result.current[0].error).toBeNull();
    expect(result.current[1].url).toBeNull();
    expect(result.current[1].error).toBeTruthy();
  });
});
