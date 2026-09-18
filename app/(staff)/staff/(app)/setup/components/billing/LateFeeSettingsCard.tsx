import { Input, Panel, Switch } from "@/components/common";

type LateFeeSettingsCardProps = {
  enabled: boolean;
  rates: readonly string[];
  onEnabledChange: (value: boolean) => void;
  onRateChange: (index: number, value: string) => void;
};

const MONTH_LABELS = [
  "1개월차",
  "2개월차",
  "3개월차",
  "4개월차",
  "5개월차",
  "6개월차",
  "7개월차",
  "8개월차",
  "9개월차",
  "10개월차",
  "11개월차",
  "12개월차 이후",
] as const;

export function LateFeeSettingsCard({
  enabled,
  rates,
  onEnabledChange,
  onRateChange,
}: LateFeeSettingsCardProps) {
  return (
    <Panel
      title="관리비 연체 설정"
      subtitle="미납 개월 수에 따른 다른 요율 적용합니다. (단리)"
      variant="compact"
      action={<Switch ariaLabel="관리비 연체 설정" checked={enabled} onChange={onEnabledChange} />}
      className="h-[202px]"
    >
      <div className="grid h-[116px] grid-cols-8 grid-rows-[54px_54px] gap-[8px]">
        {MONTH_LABELS.map((label, index) => (
          <div
            key={label}
            className={`flex h-[54px] items-center rounded-[12px] border border-line2 bg-bg py-[8px] pl-[13px] pr-[10px] ${
              index === MONTH_LABELS.length - 1 ? "gap-[10px]" : "justify-between"
            }`}
          >
            <span className="shrink-0 text-[13px] font-bold text-t2">{label}</span>
            <div className="flex items-center gap-[8px]">
              <Input
                size="36"
                type="number"
                step="any"
                aria-label={`${label} 연체율`}
                value={rates[index] ?? ""}
                onChange={(event) => onRateChange(index, event.target.value)}
                className="w-[70px] shrink-0 text-right"
              />
              <span className="text-[13.5px] font-semibold text-t2">%</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
