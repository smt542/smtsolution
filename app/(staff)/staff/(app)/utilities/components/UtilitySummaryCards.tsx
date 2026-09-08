import { SummaryCard } from "@/components/common";
import { formatNumber, formatWon } from "@/lib/format";
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
    { label: "총 세대", value: formatNumber(total), tone: "text-t1" },
    { label: "당월 입력", value: formatNumber(completed), tone: "text-blue" },
    { label: "미입력", value: formatNumber(missing), tone: "text-amber" },
    {
      label: "예상 부과",
      value: formatWon(expectedCharge),
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
