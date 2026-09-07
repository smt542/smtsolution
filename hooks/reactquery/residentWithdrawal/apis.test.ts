import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { residentWithdraw } from "./apis";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resident withdrawal API", () => {
  it("POSTs to the withdraw route and resolves on success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    await expect(residentWithdraw()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/resident/withdraw", { method: "POST" });
  });

  it("throws the server error message on failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "세입자 계정이 아닙니다." }),
    });

    await expect(residentWithdraw()).rejects.toThrow("세입자 계정이 아닙니다.");
  });
});
