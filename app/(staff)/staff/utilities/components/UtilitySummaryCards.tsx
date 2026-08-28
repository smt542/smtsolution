import { SummaryCard } from "@/components/common";

interface UtilitySummaryCardsProps {
  total: number;
  completed: number;
  missing: number;
  expectedCharge: number;
}

export function UtilitySummaryCards({
  total,
  completed,
  missing,
  expectedCharge,
}: UtilitySummaryCardsProps) {
  const cards = [
    { label: "총 세대", value: total.toLocaleString("ko-KR"), tone: "text-t1" },
    { label: "당월 입력", value: completed.toLocaleString("ko-KR"), tone: "text-blue" },
    { label: "미입력", value: missing.toLocaleString("ko-KR"), tone: "text-amber" },
    {
      label: "예상 부과",
      value: `${expectedCharge.toLocaleString("ko-KR")}원`,
      tone: "text-t1",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <SummaryCard
          key={card.label}
          label={card.label}
          value={card.value}
          tone={card.tone}
        />
      ))}
    </div>
  );
}
