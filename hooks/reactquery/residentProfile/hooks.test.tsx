import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  residentGetProfile: vi.fn(),
  residentSetNotifyPrefs: vi.fn(),
}));
vi.mock("./apis", () => api);

import { useSetNotifyPrefs } from "./mutations";
import { useResidentProfile } from "./queries";

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

describe("resident profile hooks", () => {
  it("loads the profile and saves notification preferences", async () => {
    api.residentGetProfile.mockResolvedValue({ tenantName: "김주민", alimtalkOptIn: true });
    api.residentSetNotifyPrefs.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const profile = renderHook(() => useResidentProfile(), { wrapper });
    await waitFor(() => expect(profile.result.current.isSuccess).toBe(true));

    const mutation = renderHook(() => useSetNotifyPrefs(), { wrapper });
    await mutation.result.current.mutateAsync({ alimtalk: false });

    expect(api.residentSetNotifyPrefs).toHaveBeenCalledWith({ alimtalk: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["residentProfile"] });
  });
});
