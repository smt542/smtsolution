import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => "toast-id"),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

import { AppError, toUserMessage, useAppToast } from "./useAppToast";

beforeEach(() => vi.clearAllMocks());

describe("useAppToast", () => {
  it("성공·안내·경고 메시지를 Sonner 경계로 전달한다", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.success("저장 완료");
    result.current.info("안내");
    result.current.warning("주의");

    expect(toastMock.success).toHaveBeenCalledWith("저장 완료");
    expect(toastMock.info).toHaveBeenCalledWith("안내");
    expect(toastMock.warning).toHaveBeenCalledWith("주의");
  });

  it("알 수 없는 오류 원문 대신 안전한 fallback을 표시한다", () => {
    const { result } = renderHook(() => useAppToast());
    result.current.error(new Error("relation attachments does not exist"), "사진을 저장하지 못했습니다.");

    expect(toastMock.error).toHaveBeenCalledWith("사진을 저장하지 못했습니다.");
    expect(toUserMessage(new AppError("다시 로그인해 주세요."))).toBe("다시 로그인해 주세요.");
    expect(toUserMessage("Failed to fetch")).toBe(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("loading toast를 성공 또는 실패 시 같은 id로 종료한다", () => {
    const { result } = renderHook(() => useAppToast());
    const successId = result.current.loading("저장 중…");
    result.current.success("저장 완료", { id: successId });
    const errorId = result.current.loading("삭제 중…");
    result.current.error(new Error("network failure"), "삭제하지 못했습니다.", { id: errorId });

    expect(toastMock.success).toHaveBeenCalledWith("저장 완료", { id: "toast-id" });
    expect(toastMock.error).toHaveBeenCalledWith("삭제하지 못했습니다.", { id: "toast-id" });
  });
});
