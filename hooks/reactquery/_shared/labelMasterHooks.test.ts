import { describe, it, expect, vi } from "vitest";
import { makeLabelMasterHooks } from "./labelMasterHooks";

const fakeApi = { list: vi.fn(), create: vi.fn(), rename: vi.fn(), softDelete: vi.fn() };

describe("makeLabelMasterHooks", () => {
  it("keys 네임스페이스 + 훅 함수 반환", () => {
    const h = makeLabelMasterHooks("roomTypes", fakeApi as any);
    expect(h.keys.all).toEqual(["roomTypes"]);
    expect(h.keys.list()).toEqual(["roomTypes", "list"]);
    expect(typeof h.useList).toBe("function");
    expect(typeof h.useCreate).toBe("function");
    expect(typeof h.useRename).toBe("function");
    expect(typeof h.useRemove).toBe("function");
  });
});
