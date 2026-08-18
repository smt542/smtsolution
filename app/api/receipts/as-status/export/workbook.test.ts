import { describe, expect, it } from "vitest";
import { buildAsStatusWorkbookData } from "./workbook";

describe("buildAsStatusWorkbookData", () => {
  it("PRD 컬럼 순서와 한글 상태·내용을 xlsx 행으로 변환한다", () => {
    const workbook = buildAsStatusWorkbookData([{
      receivedAt: "2026-08-18T01:00:00.000Z",
      buildingName: "그린빌라",
      unitNo: "A동 101호",
      title: "욕실 누수",
      content: "물이 떨어집니다.",
      status: "completed",
      resolution: "패킹 교체 완료",
    }]);

    expect(workbook.columns.map((column) => column.header)).toEqual([
      "접수일",
      "건물명",
      "호실명",
      "접수내용",
      "상태",
      "처리결과",
    ]);
    expect(workbook.rows).toEqual([expect.objectContaining({
      buildingName: "그린빌라",
      unitNo: "A동 101호",
      content: "욕실 누수\n물이 떨어집니다.",
      status: "완결",
      resolution: "패킹 교체 완료",
    })]);
  });
});
