import { Input, Panel, Radio } from "@/components/common";

export type BillingAccount = {
  bank: string;
  acct: string;
  holder: string;
  print: boolean;
};

type AccountField = "bank" | "acct" | "holder";

type AccountDepositCardProps = {
  accounts: readonly BillingAccount[];
  onChange: (index: number, field: AccountField, value: string) => void;
  onSelectPrint: (index: number) => void;
};

export function AccountDepositCard({
  accounts,
  onChange,
  onSelectPrint,
}: AccountDepositCardProps) {
  return (
    <Panel
      title="관리비 입금 계좌"
      subtitle="최대 2개 등록하고, 고지서에 인쇄할 계좌 1개를 선택해요"
      variant="compact"
      className="h-[216px]"
    >
      <div className="flex h-[132px] flex-col gap-[10px]">
        {accounts.map((account, index) => (
          <div
            key={index}
            className="flex items-center gap-[12px] rounded-[12px] border border-line2 bg-bg px-[12px] py-[10px]"
          >
            <div className="flex min-w-0 flex-1 gap-[8px]">
              <Input
                size="38"
                aria-label={`관리비 은행 ${index + 1}`}
                placeholder="은행명"
                value={account.bank}
                onChange={(event) => onChange(index, "bank", event.target.value)}
                className="w-[229px] shrink-0"
              />
              <Input
                size="38"
                aria-label={`관리비 계좌번호 ${index + 1}`}
                placeholder="계좌번호"
                value={account.acct}
                onChange={(event) => onChange(index, "acct", event.target.value)}
                className="min-w-0 flex-1"
              />
              <Input
                size="38"
                aria-label={`관리비 예금주 ${index + 1}`}
                placeholder="예금주"
                value={account.holder}
                onChange={(event) => onChange(index, "holder", event.target.value)}
                className="w-[229px] shrink-0"
              />
            </div>
            <Radio
              name="billing-print-account"
              label="고지서 출력"
              checked={account.print}
              onChange={() => onSelectPrint(index)}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
