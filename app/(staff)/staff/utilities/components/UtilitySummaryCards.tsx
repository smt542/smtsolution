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
        <div
          key={card.label}
          className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-card"
        >
          <p className="text-sm font-semibold text-t3">{card.label}</p>
          <p className={`num mt-1 text-2xl font-extrabold ${card.tone}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
