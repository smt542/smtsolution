"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Select, Checkbox, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

export function BillingSettingsTab() {
  const { data: me } = useMe();
  const { data: config } = useSetupConfig();
  const upsert = useUpsertSetupConfig();

  const [customerNotice, setCustomerNotice] = useState("");
  const [unitLabelDefault, setUnitLabelDefault] = useState<"code" | "name">("code");
  const [lateFeeMerge, setLateFeeMerge] = useState(false);
  const [printUtilityCutoff, setPrintUtilityCutoff] = useState(false);
  const [printWaterUnitPrice, setPrintWaterUnitPrice] = useState(false);
  const [printBillingPeriod, setPrintBillingPeriod] = useState(false);
  const [printDelta, setPrintDelta] = useState(false);
  const [showAsOnMain, setShowAsOnMain] = useState(false);
  const [cutoffMonths, setCutoffMonths] = useState("");

  useEffect(() => {
    if (!config) return;
    setCustomerNotice(config.customerNotice ?? "");
    setUnitLabelDefault(config.unitLabelDefault);
    setLateFeeMerge(config.lateFeeMerge);
    setPrintUtilityCutoff(config.printUtilityCutoff);
    setPrintWaterUnitPrice(config.printWaterUnitPrice);
    setPrintBillingPeriod(config.printBillingPeriod);
    setPrintDelta(config.printDelta);
    setShowAsOnMain(config.showAsOnMain);
    setCutoffMonths(config.cutoffMonths != null ? String(config.cutoffMonths) : "");
  }, [config]);

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upsert.mutateAsync({ orgId: me.orgId, patch: {
        customerNotice, unitLabelDefault, lateFeeMerge, printUtilityCutoff, printWaterUnitPrice,
        printBillingPeriod, printDelta, showAsOnMain,
        cutoffMonths: cutoffMonths === "" ? undefined : Number(cutoffMonths),
      } });
      toast.success("저장되었습니다");
    } catch (e: any) { toast.error(e.message ?? "저장 실패"); }
  };

  return (
    <Panel title="고지서 설정" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">고객 안내사항</span>
          <textarea aria-label="고객 안내사항" value={customerNotice} onChange={(e) => setCustomerNotice(e.target.value)}
            className="min-h-20 w-full rounded-xl border border-line bg-surface p-3 text-sm text-t1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">세대 표기 방식 기본값</span>
          <Select aria-label="세대 표기 방식 기본값" value={unitLabelDefault}
            onChange={(e) => setUnitLabelDefault(e.target.value as "code" | "name")}
            options={[{ value: "code", label: "코드출력" }, { value: "name", label: "이름출력" }]} />
        </label>
        <Checkbox label="연체료 합산" checked={lateFeeMerge} onChange={(e) => setLateFeeMerge(e.target.checked)} />
        <Checkbox label="단전·단수 출력" checked={printUtilityCutoff} onChange={(e) => setPrintUtilityCutoff(e.target.checked)} />
        <Checkbox label="수도 단가 출력" checked={printWaterUnitPrice} onChange={(e) => setPrintWaterUnitPrice(e.target.checked)} />
        <Checkbox label="관리비 기간 출력" checked={printBillingPeriod} onChange={(e) => setPrintBillingPeriod(e.target.checked)} />
        <Checkbox label="증감량 표시" checked={printDelta} onChange={(e) => setPrintDelta(e.target.checked)} />
        <Checkbox label="AS현황 메인표시" checked={showAsOnMain} onChange={(e) => setShowAsOnMain(e.target.checked)} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-t2">단수 개월 수</span>
          <Input aria-label="단수 개월 수" type="number" value={cutoffMonths} onChange={(e) => setCutoffMonths(e.target.value)} />
        </label>
      </div>
    </Panel>
  );
}
