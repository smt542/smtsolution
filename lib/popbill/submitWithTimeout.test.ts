import { afterEach, describe, expect, it, vi } from "vitest";
import { PopbillTimeoutError, submitWithTimeout } from "./types";

describe("submitWithTimeout 동기 예외 가드", () => {
  afterEach(() => vi.useRealTimers());

  it("executor가 동기적으로 throw하면 그 오류로 reject하고 타이머를 정리한다", async () => {
    vi.useFakeTimers();
    const boom = new Error("sync boom");
    const promise = submitWithTimeout<string>(() => {
      throw boom;
    }, 1000);
    await expect(promise).rejects.toBe(boom);
    // safeReject를 거쳐야 타이머가 clearTimeout된다. 남은 타이머가 없어야 한다(타임아웃 콜백 누수 방지).
    expect(vi.getTimerCount()).toBe(0);
  });

  it("동기 throw 후 타임아웃이 도래해도 PopbillTimeoutError로 뒤집히지 않는다", async () => {
    vi.useFakeTimers();
    const boom = new Error("sync boom");
    const promise = submitWithTimeout<string>(() => {
      throw boom;
    }, 1000);
    const assertion = expect(promise).rejects.toBe(boom);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("정상 동기 resolve는 타이머를 정리한다", async () => {
    vi.useFakeTimers();
    const out = await submitWithTimeout<string>((resolve) => resolve("ok"), 1000);
    expect(out).toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("타임아웃 경로는 PopbillTimeoutError로 reject한다", async () => {
    vi.useFakeTimers();
    const promise = submitWithTimeout<string>(() => {
      // 콜백을 호출하지 않는다(무응답).
    }, 1000);
    const assertion = expect(promise).rejects.toBeInstanceOf(PopbillTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});
