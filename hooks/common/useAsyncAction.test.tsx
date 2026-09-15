import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAsyncAction } from "./useAsyncAction";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe("useAsyncAction", () => {
  it("동시에 실행하면 진행 중인 Promise를 재사용한다", async () => {
    const pending = deferred<string>();
    const action = vi.fn(() => pending.promise);
    const { result } = renderHook(() => useAsyncAction());

    let first!: Promise<string>;
    let second!: Promise<string>;
    act(() => {
      first = result.current.run(action);
      second = result.current.run(action);
    });

    expect(action).toHaveBeenCalledTimes(0);
    expect(second).toBe(first);
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      pending.resolve("완료");
      await first;
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(false);
    await expect(first).resolves.toBe("완료");
  });

  it("실패를 저장하고 reset으로 지운다", async () => {
    const failure = new Error("실패");
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current.run(() => Promise.reject(failure)).catch(() => undefined);
    });
    expect(result.current.error).toBe(failure);
    expect(result.current.isPending).toBe(false);

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
