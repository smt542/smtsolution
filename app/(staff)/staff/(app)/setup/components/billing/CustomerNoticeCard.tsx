import { Panel, Textarea } from "@/components/common";

type CustomerNoticeCardProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CustomerNoticeCard({ value, onChange }: CustomerNoticeCardProps) {
  return (
    <Panel
      title="고객 안내사항"
      subtitle="고지서 하단에 인쇄되는 안내 문구예요"
      variant="compact"
      className="h-[351px]"
    >
      <Textarea
        aria-label="고객 안내사항"
        variant="compact"
        showCount
        maxLength={250}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[237px] min-h-[92px] resize-none"
      />
    </Panel>
  );
}
