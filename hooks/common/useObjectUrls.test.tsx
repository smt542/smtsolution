import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useObjectUrls } from "./useObjectUrls";

const createObjectURL = vi.fn((file: File) => `blob:${file.name}`);
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
});

describe("useObjectUrls", () => {
  it("파일별 URL을 만들고 파일 목록이 바뀌면 이전 URL을 해제한다", async () => {
    const first = new File(["1"], "first.png", { type: "image/png" });
    const second = new File(["2"], "second.png", { type: "image/png" });
    const { result, rerender } = renderHook(
      ({ files }) => useObjectUrls(files),
      { initialProps: { files: [first] } },
    );

    await waitFor(() => expect(result.current).toEqual([{ file: first, url: "blob:first.png" }]));
    rerender({ files: [second] });

    await waitFor(() => expect(result.current).toEqual([{ file: second, url: "blob:second.png" }]));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first.png");
  });

  it("unmount 때 현재 URL을 모두 해제한다", async () => {
    const file = new File(["1"], "photo.webp", { type: "image/webp" });
    const files = [file];
    const { result, unmount } = renderHook(() => useObjectUrls(files));
    await waitFor(() => expect(result.current).toHaveLength(1));

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:photo.webp");
  });
});
