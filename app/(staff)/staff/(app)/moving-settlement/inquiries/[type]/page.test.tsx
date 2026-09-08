import { describe, expect, it } from "vitest";
import MovingSettlementInquiryRoute, { generateStaticParams } from "./page";

describe("MovingSettlementInquiryRoute", () => {
  it("네 조회 유형을 정적 파라미터로 제공한다", () => {
    expect(generateStaticParams()).toEqual([
      { type: "water" },
      { type: "electric" },
      { type: "gas" },
      { type: "all" },
    ]);
  });

  it("Next.js 16 비동기 params를 해석해 공통 화면에 전달한다", async () => {
    const result = await MovingSettlementInquiryRoute({
      params: Promise.resolve({ type: "electric" }),
    });

    expect(result.props.type).toBe("electric");
  });
});
