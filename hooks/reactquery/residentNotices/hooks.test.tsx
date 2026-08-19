import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  residentNoticeDetail: vi.fn(),
  residentNotices: vi.fn(),
}));
vi.mock("./apis", () => api);

import { useResidentNoticeDetail, useResidentNotices } from "./queries";

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe("resident notice hooks", () => {
  it("loads list and detail data", async () => {
    api.residentNotices.mockResolvedValue([{ id: 4, title: "공지" }]);
    api.residentNoticeDetail.mockResolvedValue({ id: 4, content: "본문" });
    const { wrapper } = setup();

    const list = renderHook(() => useResidentNotices(), { wrapper });
    const detail = renderHook(() => useResidentNoticeDetail(4), { wrapper });

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(api.residentNotices).toHaveBeenCalledOnce();
    expect(api.residentNoticeDetail).toHaveBeenCalledWith(4);
  });
});
