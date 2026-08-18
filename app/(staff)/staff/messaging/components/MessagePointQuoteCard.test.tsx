import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessagePointQuoteCard } from "./MessagePointQuoteCard";

const quote = {
  recipientCount: 3,
  excludedCount: 1,
  channelCounts: { sms: 2, alimtalk: 1 },
  rateSnapshot: {
    sms: { rateId: 1, points: 1 },
    alimtalk: { rateId: 2, points: 2 },
  },
  ledgerBalance: 100,
  reservedPoints: 10,
  availablePoints: 90,
  estimatedPoints: 4,
  sufficient: true,
  billingMode: "stub" as const,
};

describe("MessagePointQuoteCard", () => {
  it("채널별 단가·가용 잔액과 stub 비과금 안내를 표시한다", () => {
    render(<MessagePointQuoteCard quote={quote} />);

    expect(screen.getByText(/SMS 2건 × 1 P/)).toBeInTheDocument();
    expect(screen.getByText(/알림톡 1건 × 2 P/)).toBeInTheDocument();
    expect(screen.getByText("예상 4 P")).toBeInTheDocument();
    expect(screen.getByText("테스트 발송 — 실제 전송 및 포인트 차감 없음")).toBeInTheDocument();
  });

  it("live 잔액 부족을 danger 상태로 안내한다", () => {
    render(
      <MessagePointQuoteCard
        quote={{ ...quote, billingMode: "live", sufficient: false, availablePoints: 2 }}
      />,
    );

    expect(screen.getByText("가용 포인트가 부족합니다. 4 P가 필요합니다.")).toBeInTheDocument();
  });
});
