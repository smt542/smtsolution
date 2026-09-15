import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("지연시간이 지난 뒤 최신 값만 반영한다", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "처음" } },
    );

    rerender({ value: "중간" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "최종" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("처음");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("최종");
  });

  it("unmount 때 예약된 갱신을 취소한다", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
