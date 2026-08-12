"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Select, Checkbox, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  useSettlementCheckItems, useCreateSettlementCheckItem,
  useRenameSettlementCheckItem, useDeleteSettlementCheckItem,
} from "@/hooks/reactquery/settlementCheckItems";
import { MasterListEditor } from "./MasterListEditor";

export function MovingSettlementSettingsTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: config } = useSetupConfig(me?.orgId);
  const upsert = useUpsertSetupConfig();

  const [waterUnitReflect, setWater] = useState(false);
  const [electricUnitReflect, setElec] = useState(false);
  const [vacancyPaymentMode, setMode] = useState<"manual" | "auto">("manual");
  useEffect(() => {
    if (!config) return;
    setWater(config.waterUnitReflect);
    setElec(config.electricUnitReflect);
    setMode(config.vacancyPaymentMode);
  }, [config]);

  const save = async () => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upsert.mutateAsync({ orgId, patch: { waterUnitReflect, electricUnitReflect, vacancyPaymentMode } });
      toast.success("저장되었습니다");
    } catch (e: any) { toast.error(e.message ?? "저장 실패"); }
  };

  const { data: items = [] } = useSettlementCheckItems();
  const createItem = useCreateSettlementCheckItem();
  const renameItem = useRenameSettlementCheckItem();
  const deleteItem = useDeleteSettlementCheckItem();
  const onAdd = async (label: string) => {
    if (!orgId) return;
    try { await createItem.mutateAsync({ orgId, label }); } catch (e: any) { toast.error(e.message ?? "추가 실패"); }
  };
  const onRename = async (id: number, label: string) => {
    try { await renameItem.mutateAsync({ id, label }); } catch (e: any) { toast.error(e.message ?? "수정 실패"); }
  };
  const onDelete = async (id: number) => {
    try { await deleteItem.mutateAsync(id); } catch (e: any) { toast.error(e.message ?? "삭제 실패"); }
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel title="이사정산 설정" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
        <div className="flex flex-col gap-4">
          <Checkbox label="이사정산 시 수도 단가 반영" checked={waterUnitReflect} onChange={(e) => setWater(e.target.checked)} />
          <Checkbox label="이사정산 시 전기 단가 반영" checked={electricUnitReflect} onChange={(e) => setElec(e.target.checked)} />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-t2">공실 처리 시 수납 방식</span>
            <Select aria-label="공실 처리 시 수납 방식" value={vacancyPaymentMode}
              onChange={(e) => setMode(e.target.value as "manual" | "auto")}
              options={[{ value: "manual", label: "수동" }, { value: "auto", label: "자동" }]} />
          </label>
        </div>
      </Panel>
      <MasterListEditor
        title="이사정산 체크항목"
        items={items.map((i) => ({ id: i.id, label: i.label }))}
        onAdd={onAdd} onRename={onRename} onDelete={onDelete}
      />
    </div>
  );
}
