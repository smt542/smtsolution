import type { ReactNode } from "react";

/**
 * 요약 통계 카드. 라벨 + 강조 값 하나. 그리드 배치는 호출부에서 감싼다.
 * `tone`은 값 텍스트 색상 클래스(예: "text-blue" / "text-amber").
 */
export function SummaryCard({
  label,
  value,
  tone = "text-t1",
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
      <p className="text-sm font-semibold text-t3">{label}</p>
      <p className={`num mt-1 text-2xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}
