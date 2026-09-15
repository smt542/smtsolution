import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("기본 로딩 상태에 접근 가능한 이름을 제공한다", () => {
    render(<Spinner />);

    const status = screen.getByRole("status", { name: "불러오는 중" });
    expect(status).toBeInTheDocument();
    expect(status.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("작업별 이름과 표시 문구를 지원한다", () => {
    render(<Spinner label="조직 목록 갱신 중" size="small" showLabel />);

    expect(screen.getByRole("status", { name: "조직 목록 갱신 중" })).toHaveTextContent(
      "조직 목록 갱신 중",
    );
  });
});
