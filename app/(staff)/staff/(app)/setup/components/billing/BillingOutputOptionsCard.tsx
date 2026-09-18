import { Input, Panel, SegmentedControl } from "@/components/common";

type OutputKey =
  | "printUtilityCutoff"
  | "printWaterUnitPrice"
  | "printBillingPeriod"
  | "printDelta";

type BillingOutputOptionsCardProps = {
  printUtilityCutoff: boolean;
  printWaterUnitPrice: boolean;
  printBillingPeriod: boolean;
  printDelta: boolean;
  cutoffMonths: string;
  onToggle: (key: OutputKey, value: boolean) => void;
  onCutoffMonthsChange: (value: string) => void;
};

const OUTPUT_OPTIONS = [
  {
    key: "printUtilityCutoff",
    label: "단전·단수 출력",
  },
  {
    key: "printWaterUnitPrice",
    label: "수도 단가 출력",
  },
  {
    key: "printBillingPeriod",
    label: "관리비 기간 출력",
  },
  {
    key: "printDelta",
    label: "증감량 표시",
  },
] as const satisfies readonly { key: OutputKey; label: string }[];

const PRINT_OPTIONS = [
  { value: "true", label: "출력" },
  { value: "false", label: "미출력" },
];

export function BillingOutputOptionsCard({
  printUtilityCutoff,
  printWaterUnitPrice,
  printBillingPeriod,
  printDelta,
  cutoffMonths,
  onToggle,
  onCutoffMonthsChange,
}: BillingOutputOptionsCardProps) {
  const values: Record<OutputKey, boolean> = {
    printUtilityCutoff,
    printWaterUnitPrice,
    printBillingPeriod,
    printDelta,
  };

  return (
    <Panel
      title="출력 옵션"
      subtitle="고지서에 표기할 항목을 선택해요"
      variant="compact"
      className="h-[351px]"
    >
      <div className="flex flex-col">
        {OUTPUT_OPTIONS.map((option, index) => {
          const segment = (
            <SegmentedControl
              options={PRINT_OPTIONS}
              value={String(values[option.key])}
              onChange={(value) => onToggle(option.key, value === "true")}
            />
          );

          return (
            <div
              key={option.key}
              className={`flex items-center gap-[16px] ${
                index === 0
                  ? "border-b border-line2 pb-[12px]"
                  : index === OUTPUT_OPTIONS.length - 1
                    ? "pt-[12px]"
                    : "border-b border-line2 py-[12px]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="h-[16px] text-[14px] font-bold leading-[16px] text-t1">{option.label}</div>
              </div>
              {index === 0 ? (
                <div className="flex shrink-0 items-center gap-[10px]">
                  <div className="flex items-center gap-[8px]">
                    <Input
                      size="40"
                      type="number"
                      aria-label="단전·단수 출력 개월 수"
                      value={cutoffMonths}
                      onChange={(event) => onCutoffMonthsChange(event.target.value)}
                      className="w-[78px] text-right"
                    />
                    <span className="text-[13.5px] font-semibold text-t2">개월부터</span>
                  </div>
                  {segment}
                </div>
              ) : (
                <div className="shrink-0">{segment}</div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
