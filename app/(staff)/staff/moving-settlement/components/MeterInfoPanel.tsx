import type { MeterSummary } from "@/hooks/reactquery/movingSettlement";

const LABELS: Record<MeterSummary["utility"], string> = {
  water: "수도",
  elec: "전기",
  gas: "가스",
};

function formatReading(value: number | null): string {
  return value === null ? "-" : value.toLocaleString("ko-KR");
}

export function MeterInfoPanel({ meters }: { meters: MeterSummary[] }) {
  const byUtility = new Map(meters.map((meter) => [meter.utility, meter]));

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-base font-extrabold text-t1">검침정보</h2>
      <div className="mt-4 space-y-3">
        {(["water", "elec", "gas"] as const).map((utility) => {
          const meter = byUtility.get(utility);

          return (
            <div key={utility} className="rounded-xl border border-line2 p-3">
              <p className="text-sm font-bold text-t1">{LABELS[utility]}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-t3">전월</dt>
                  <dd>{formatReading(meter?.previousReading ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-t3">당월</dt>
                  <dd>{formatReading(meter?.currentReading ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-t3">사용량</dt>
                  <dd>{formatReading(meter?.usage ?? null)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}
