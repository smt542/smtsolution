"use client";
import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Input, nextDefaultLabel, NumberedTagList, Panel, SegmentedControl } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  useSettlementCheckItems, useCreateSettlementCheckItem,
  useRenameSettlementCheckItem, useDeleteSettlementCheckItem,
} from "@/hooks/reactquery/settlementCheckItems";
import { useRegisterSetupSave } from "../SetupSaveContext";

const MAX_CHECK_ITEMS = 24;

type SettlementAccount = {
  settleBank: string;
  settleAcct: string;
  settleHolder: string;
};

const EMPTY_ACCOUNT: SettlementAccount = { settleBank: "", settleAcct: "", settleHolder: "" };

// 정산 기준은 고정값이다(QA S26·마이그 0202): 수도·전기 단가 반영, 공실 수납 수동.
// 정본 `.st-seg.lock`처럼 잠근 채 저장값을 보여 주고, 이 탭의 저장은 계좌만 보낸다.
const SETTLEMENT_RULES = [
  {
    key: "waterUnitReflect",
    label: "수도 단가 반영",
    subtitle: "정산 시 수도 단가를 금액에 반영 · 변경 불가",
    options: [{ value: "true", label: "반영" }, { value: "false", label: "안함" }],
  },
  {
    key: "electricUnitReflect",
    label: "전기 단가 반영",
    subtitle: "정산 시 전기 단가를 금액에 반영 · 변경 불가",
    options: [{ value: "true", label: "반영" }, { value: "false", label: "안함" }],
  },
  {
    key: "vacancyPaymentMode",
    label: "공실 수납 처리",
    subtitle: "퇴실 후 공실 세대의 수납 처리 방식 · 변경 불가",
    options: [{ value: "manual", label: "수동" }, { value: "auto", label: "자동" }],
  },
] as const;

export function MovingSettlementSettingsTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: config } = useSetupConfig(me?.orgId);
  const upsert = useUpsertSetupConfig();

  const [account, setAccount] = useState<SettlementAccount>(EMPTY_ACCOUNT);

  useEffect(() => {
    if (!config) return;
    setAccount.call(undefined, {
      settleBank: config.settleBank ?? "",
      settleAcct: config.settleAcct ?? "",
      settleHolder: config.settleHolder ?? "",
    });
  }, [config]);

  const ruleValue = (key: (typeof SETTLEMENT_RULES)[number]["key"]): string => {
    if (key === "waterUnitReflect") return String(config?.waterUnitReflect ?? true);
    if (key === "electricUnitReflect") return String(config?.electricUnitReflect ?? true);
    return config?.vacancyPaymentMode ?? "manual";
  };

  const save = async () => {
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upsert.mutateAsync({ orgId, patch: { ...account } });
      toast.success("저장되었습니다");
    } catch (e) {
      toast.error(e, "이사정산 설정을 저장하지 못했습니다.");
    }
  };

  useRegisterSetupSave(save, upsert.isPending);

  const { data } = useSettlementCheckItems();
  const items = data ?? [];
  const createItem = useCreateSettlementCheckItem();
  const renameItem = useRenameSettlementCheckItem();
  const deleteItem = useDeleteSettlementCheckItem();
  const [labels, setLabels] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!data) return;
    setLabels.call(undefined, Object.fromEntries(data.map((item) => [item.id, item.label])));
  }, [data]);

  const onAdd = () => {
    if (!orgId || createItem.isPending) return;
    // 정본 #ckAdd: 가득 차도 버튼은 그대로 두고 누르면 안내만 한다.
    if (items.length >= MAX_CHECK_ITEMS) {
      toast.warning(`항목은 최대 ${MAX_CHECK_ITEMS}개까지예요`);
      return;
    }
    // settlement_check_items는 (org_id, label)이 유니크라 기본 이름을 그대로 쓰면 두 번째 추가가 실패한다.
    const label = nextDefaultLabel(items.map((item) => item.label), "새 항목");
    void createItem.mutateAsync({ orgId, label }).catch((e) => {
      toast.error(e, "이사정산 체크항목을 추가하지 못했습니다.");
    });
  };

  /** 입력 중에는 초안만 갱신한다. 저장은 onCommitRename에서만 한다. */
  const onChangeLabel = (id: string, label: string) =>
    setLabels((current) => ({ ...current, [Number(id)]: label }));

  const onCommitRename = (id: string, label: string) => {
    const numericId = Number(id);
    const original = items.find((item) => item.id === numericId)?.label ?? "";
    const next = label.trim();
    if (!next || next === original) {
      setLabels((current) => ({ ...current, [numericId]: original }));
      return;
    }
    void renameItem.mutateAsync({ id: numericId, label: next }).catch((e) => {
      setLabels((current) => ({ ...current, [numericId]: original }));
      toast.error(e, "이사정산 체크항목을 변경하지 못했습니다.");
    });
  };

  const onDelete = (id: string) => {
    void deleteItem.mutateAsync(Number(id)).catch((e) => {
      toast.error(e, "이사정산 체크항목을 삭제하지 못했습니다.");
    });
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <Panel title="이사정산 입금 계좌" subtitle="이사정산 내역서에 인쇄돼요" variant="compact">
        <div className="flex gap-[8px] rounded-[12px] border border-line2 bg-bg px-[12px] py-[10px]">
          <Input
            size="38"
            aria-label="정산 은행"
            placeholder="은행명"
            value={account.settleBank}
            onChange={(event) => setAccount((current) => ({ ...current, settleBank: event.target.value }))}
            className="w-[229px] shrink-0"
          />
          <Input
            size="38"
            aria-label="정산 계좌번호"
            placeholder="계좌번호"
            value={account.settleAcct}
            onChange={(event) => setAccount((current) => ({ ...current, settleAcct: event.target.value }))}
            className="min-w-0 flex-1"
          />
          <Input
            size="38"
            aria-label="정산 예금주"
            placeholder="예금주"
            value={account.settleHolder}
            onChange={(event) => setAccount((current) => ({ ...current, settleHolder: event.target.value }))}
            className="w-[229px] shrink-0"
          />
        </div>
      </Panel>

      <Panel
        title="정산 체크 항목"
        subtitle="이사정산 입력의 정산 체크에 노출돼요 · 최대 24개"
        variant="compact"
        action={<span className="text-[12px] font-semibold text-t4 tabular-nums">{items.length} / {MAX_CHECK_ITEMS}</span>}
      >
        <NumberedTagList
          items={items.map((item) => ({ id: String(item.id), label: labels[item.id] ?? item.label }))}
          columns={5}
          onChange={onChangeLabel}
          onCommit={onCommitRename}
          onDelete={onDelete}
          onAdd={onAdd}
          addLabel="＋ 항목 추가"
        />
      </Panel>

      <Panel title="정산 기준" subtitle="이사정산 계산에 적용되는 기본 규칙이에요" variant="compact">
        <div className="flex flex-col gap-[10px]">
          {SETTLEMENT_RULES.map((rule, index) => (
            <div
              key={rule.key}
              className={`flex items-center gap-[16px] ${
                index === 0
                  ? "border-b border-line2 pb-[12px]"
                  : index === SETTLEMENT_RULES.length - 1
                    ? "pt-[12px]"
                    : "border-b border-line2 py-[12px]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="h-[16px] text-[14px] font-bold leading-[16px] text-t1">{rule.label}</div>
                <div className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{rule.subtitle}</div>
              </div>
              <SegmentedControl
                options={[...rule.options]}
                value={ruleValue(rule.key)}
                onChange={() => {}}
                disabled
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
