import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoUpload } from "./PhotoUpload";

const toastError = vi.fn();
vi.mock("@/hooks/common", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/common")>();
  return { ...actual, useAppToast: () => ({ error: toastError }) };
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});

describe("PhotoUpload", () => {
  it("실제 File 목록을 controlled callback으로 전달하고 같은 파일 재선택을 허용한다", async () => {
    const onFilesChange = vi.fn();
    const { rerender } = render(<PhotoUpload files={[]} onFilesChange={onFilesChange} />);
    const input = screen.getByLabelText("계약서 사진 선택") as HTMLInputElement;
    const file = new File(["photo"], "contract.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesChange).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");

    rerender(<PhotoUpload files={[]} onFilesChange={onFilesChange} />);
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFilesChange).toHaveBeenCalledTimes(2);
  });

  it("허용하지 않는 MIME은 즉시 거절한다", async () => {
    const onFilesChange = vi.fn();
    render(<PhotoUpload files={[]} onFilesChange={onFilesChange} />);
    const file = new File(["gif"], "animated.gif", { type: "image/gif" });

    fireEvent.change(screen.getByLabelText("계약서 사진 선택"), { target: { files: [file] } });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onFilesChange).not.toHaveBeenCalled();
  });
});
