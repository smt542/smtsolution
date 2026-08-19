import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  residentCancelMoveOut: vi.fn(),
  residentCreateMoveOut: vi.fn(),
  residentGetMoveOut: vi.fn(),
  residentUpdateMoveOut: vi.fn(),
}));
vi.mock("./apis", () => api);

import {
  useCancelMoveOut,
  useCreateMoveOut,
  useUpdateMoveOut,
} from "./mutations";
import { useMoveOutRequest } from "./queries";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe("resident move-out hooks", () => {
  it("loads a request and invalidates it after each mutation", async () => {
    api.residentGetMoveOut.mockResolvedValue({ id: 1, status: "pending" });
    api.residentCreateMoveOut.mockResolvedValue(1);
    api.residentUpdateMoveOut.mockResolvedValue(undefined);
    api.residentCancelMoveOut.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const request = renderHook(() => useMoveOutRequest(), { wrapper });
    await waitFor(() => expect(request.result.current.isSuccess).toBe(true));

    const create = renderHook(() => useCreateMoveOut(), { wrapper });
    const update = renderHook(() => useUpdateMoveOut(), { wrapper });
    const cancel = renderHook(() => useCancelMoveOut(), { wrapper });
    await create.result.current.mutateAsync({ desiredDate: "2026-09-30", reason: null });
    await update.result.current.mutateAsync("2026-10-05");
    await cancel.result.current.mutateAsync();

    expect(api.residentCreateMoveOut).toHaveBeenCalledWith("2026-09-30", null);
    expect(api.residentUpdateMoveOut).toHaveBeenCalledWith("2026-10-05");
    expect(api.residentCancelMoveOut).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["residentMoveOut"] });
  });
});
