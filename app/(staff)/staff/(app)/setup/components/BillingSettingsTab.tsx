"use client";

import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useLateFeeRateTiers,
  useReplaceLateFeeRateTiers,
} from "@/hooks/reactquery/lateFeeTiers";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useRegisterSetupSave } from "../SetupSaveContext";
import { AccountDepositCard, type BillingAccount } from "./billing/AccountDepositCard";
import { BillingOutputOptionsCard } from "./billing/BillingOutputOptionsCard";
import { CustomerNoticeCard } from "./billing/CustomerNoticeCard";
import { LateFeeSettingsCard } from "./billing/LateFeeSettingsCard";
import {
  lateFeeTiersToMonthlyRates,
  monthlyRatesToLateFeeTiers,
} from "./lateFeeTiersAdapter";

const EMPTY_ACCOUNTS: BillingAccount[] = [
  { bank: "", acct: "", holder: "", print: true },
  { bank: "", acct: "", holder: "", print: false },
];

export function BillingSettingsTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId ?? null;
  const { data: config, isLoading: configLoading } = useSetupConfig(me?.orgId);
  const { data: lateFeeTiers, isLoading: lateFeeTiersLoading } = useLateFeeRateTiers(orgId);
  const upsert = useUpsertSetupConfig();
  const replaceLateFeeTiers = useReplaceLateFeeRateTiers();

  const [accounts, setAccounts] = useState<BillingAccount[]>(EMPTY_ACCOUNTS);
  const [customerNotice, setCustomerNotice] = useState("");
  const [printUtilityCutoff, setPrintUtilityCutoff] = useState(false);
  const [printWaterUnitPrice, setPrintWaterUnitPrice] = useState(false);
  const [printBillingPeriod, setPrintBillingPeriod] = useState(false);
  const [printDelta, setPrintDelta] = useState(false);
  const [cutoffMonths, setCutoffMonths] = useState("");
  const [lateFeeEnabled, setLateFeeEnabled] = useState(true);
  const [lateFeeRates, setLateFeeRates] = useState<string[]>(() =>
    Array.from({ length: 12 }, () => "0"),
  );

  useEffect(() => {
    if (!config) return;
    setAccounts.call(undefined, [
      {
        bank: config.mgmtBank1 ?? "",
        acct: config.mgmtAcct1 ?? "",
        holder: config.mgmtHolder1 ?? "",
        print: config.mgmtPrint1 || !config.mgmtPrint2,
      },
      {
        bank: config.mgmtBank2 ?? "",
        acct: config.mgmtAcct2 ?? "",
        holder: config.mgmtHolder2 ?? "",
        print: !config.mgmtPrint1 && config.mgmtPrint2,
      },
    ]);
    setCustomerNotice.call(undefined, config.customerNotice ?? "");
    setPrintUtilityCutoff.call(undefined, config.printUtilityCutoff);
    setPrintWaterUnitPrice.call(undefined, config.printWaterUnitPrice);
    setPrintBillingPeriod.call(undefined, config.printBillingPeriod);
    setPrintDelta.call(undefined, config.printDelta);
    setCutoffMonths.call(undefined, config.cutoffMonths != null ? String(config.cutoffMonths) : "");
    setLateFeeEnabled.call(undefined, config.lateFeeEnabled);
  }, [config]);

  useEffect(() => {
    if (!lateFeeTiers) return;
    setLateFeeRates.call(undefined, lateFeeTiersToMonthlyRates(lateFeeTiers).map(String));
  }, [lateFeeTiers]);

  const updateAccount = (index: number, field: keyof Omit<BillingAccount, "print">, value: string) => {
    setAccounts((current) => current.map((account, accountIndex) =>
      accountIndex === index ? { ...account, [field]: value } : account,
    ));
  };

  const selectPrintAccount = (index: number) => {
    setAccounts((current) => current.map((account, accountIndex) => ({
      ...account,
      print: accountIndex === index,
    })));
  };

  const save = async () => {
    if (!orgId) {
      toast.error("인증 정보가 없습니다");
      return;
    }
    if (!lateFeeTiers) {
      toast.error("연체 요율 정보를 불러오는 중입니다");
      return;
    }

    const monthlyRates = lateFeeRates.map((rate) => {
      const value = Number(rate);
      return Number.isFinite(value) ? value : 0;
    });

    try {
      await Promise.all([
        upsert.mutateAsync({
          orgId,
          patch: {
            customerNotice,
            mgmtBank1: accounts[0].bank,
            mgmtAcct1: accounts[0].acct,
            mgmtHolder1: accounts[0].holder,
            mgmtPrint1: accounts[0].print,
            mgmtBank2: accounts[1].bank,
            mgmtAcct2: accounts[1].acct,
            mgmtHolder2: accounts[1].holder,
            mgmtPrint2: accounts[1].print,
            printUtilityCutoff,
            printWaterUnitPrice,
            printBillingPeriod,
            printDelta,
            cutoffMonths: cutoffMonths === "" ? null : Number(cutoffMonths),
            lateFeeEnabled,
          },
        }),
        replaceLateFeeTiers.mutateAsync({
          orgId,
          tiers: monthlyRatesToLateFeeTiers(monthlyRates),
        }),
      ]);
      toast.success("저장되었습니다");
    } catch (error) {
      toast.error(error, "고지서 설정을 저장하지 못했습니다.");
    }
  };

  useRegisterSetupSave(
    save,
    configLoading || lateFeeTiersLoading || upsert.isPending || replaceLateFeeTiers.isPending,
  );

  return (
    <div className="grid grid-cols-[minmax(0,770.47fr)_minmax(0,847.53fr)] gap-[14px]">
      <div className="col-span-2">
        <AccountDepositCard
          accounts={accounts}
          onChange={updateAccount}
          onSelectPrint={selectPrintAccount}
        />
      </div>
      <CustomerNoticeCard value={customerNotice} onChange={setCustomerNotice} />
      <BillingOutputOptionsCard
        printUtilityCutoff={printUtilityCutoff}
        printWaterUnitPrice={printWaterUnitPrice}
        printBillingPeriod={printBillingPeriod}
        printDelta={printDelta}
        cutoffMonths={cutoffMonths}
        onToggle={(key, value) => {
          if (key === "printUtilityCutoff") setPrintUtilityCutoff(value);
          if (key === "printWaterUnitPrice") setPrintWaterUnitPrice(value);
          if (key === "printBillingPeriod") setPrintBillingPeriod(value);
          if (key === "printDelta") setPrintDelta(value);
        }}
        onCutoffMonthsChange={setCutoffMonths}
      />
      <div className="col-span-2">
        <LateFeeSettingsCard
          enabled={lateFeeEnabled}
          rates={lateFeeRates}
          onEnabledChange={setLateFeeEnabled}
          onRateChange={(index, value) => {
            setLateFeeRates((current) => current.map((rate, rateIndex) =>
              rateIndex === index ? value : rate,
            ));
          }}
        />
      </div>
    </div>
  );
}
