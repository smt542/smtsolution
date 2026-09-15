import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AsyncContentState } from "./AsyncContentState";

describe("AsyncContentState", () => {
  it("최초 로딩에는 콘텐츠 대신 작업별 상태를 표시한다", () => {
    render(
      <AsyncContentState loading loadingLabel="수납내역 불러오는 중">
        <p>기존 수납내역</p>
      </AsyncContentState>,
    );

    expect(screen.getByRole("status", { name: "수납내역 불러오는 중" })).toBeInTheDocument();
    expect(screen.queryByText("기존 수납내역")).not.toBeInTheDocument();
  });

  it("백그라운드 갱신에는 기존 콘텐츠를 유지한다", () => {
    render(
      <AsyncContentState refreshing refreshingLabel="수납내역 갱신 중">
        <p>기존 수납내역</p>
      </AsyncContentState>,
    );

    expect(screen.getByText("기존 수납내역")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "수납내역 갱신 중" })).toBeInTheDocument();
  });

  it("오류 상태는 로딩 및 빈 상태와 별도로 알린다", () => {
    render(
      <AsyncContentState error empty emptyMessage="내역 없음">
        <p>기존 수납내역</p>
      </AsyncContentState>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("자료를 불러오지 못했습니다.");
    expect(screen.queryByText("내역 없음")).not.toBeInTheDocument();
  });
});
