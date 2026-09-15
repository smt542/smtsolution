import { describe, expect, it, vi } from "vitest";
import type { UseFormSetError } from "react-hook-form";
import { setSubmissionError } from "./formErrors";

type Values = { name: string; phone: string };

describe("setSubmissionError", () => {
  it("구조화된 서버 필드 오류를 필드에 연결하고 첫 오류만 포커스한다", () => {
    const setError = vi.fn() as unknown as UseFormSetError<Values>;
    setSubmissionError<Values>({
      fieldErrors: { name: "중복된 이름입니다", phone: ["전화번호를 확인해 주세요"] },
    }, setError, "저장 실패");

    expect(setError).toHaveBeenNthCalledWith(1, "name", {
      type: "server",
      message: "중복된 이름입니다",
    }, { shouldFocus: true });
    expect(setError).toHaveBeenNthCalledWith(2, "phone", {
      type: "server",
      message: "전화번호를 확인해 주세요",
    }, { shouldFocus: false });
    expect(setError).not.toHaveBeenCalledWith("root.server", expect.anything());
  });

  it("일반 서버 오류는 전역 오류로 분리한다", () => {
    const setError = vi.fn() as unknown as UseFormSetError<Values>;
    setSubmissionError<Values>(new Error("서버 연결 실패"), setError, "저장 실패");
    expect(setError).toHaveBeenCalledWith("root.server", {
      type: "server",
      message: "서버 연결 실패",
    });
  });
});
