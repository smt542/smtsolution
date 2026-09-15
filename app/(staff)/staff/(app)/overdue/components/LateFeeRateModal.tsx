"use client";

import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Modal } from "@/components/common";
import {
  useLateFeeRateTiers,
  useReplaceLateFeeRateTiers,
  type LateFeeRateTier,
  type LateFeeRateTierInput,
} from "@/hooks/reactquery/lateFeeTiers";

interface DraftTier {
  fromMonth: number;
  toMonth: number | null;
  monthlyRate: number;
}

interface LateFeeRateModalProps {
  open: boolean;
  orgId: number;
  onClose: () => void;
}

export function LateFeeRateModal({
  open,
  orgId,
  onClose,
}: LateFeeRateModalProps) {
  const {
    data: tiers = [],
    isLoading,
    isError,
  } = useLateFeeRateTiers(open ? orgId : null);
  const editorKey = isLoading
    ? "loading"
    : tiers
        .map((tier) =>
          [tier.id, tier.fromMonth, tier.toMonth, tier.monthlyRate].join(":"),
        )
        .join("|");

  return (
    <Modal open={open} title="연체료 요율 설정" onClose={onClose}>
      {open && (
        <LateFeeRateEditor
          key={editorKey}
          orgId={orgId}
          tiers={tiers}
          isLoading={isLoading}
          isError={isError}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function LateFeeRateEditor({
  orgId,
  tiers,
  isLoading,
  isError,
  onClose,
}: {
  orgId: number;
  tiers: LateFeeRateTier[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  const replace = useReplaceLateFeeRateTiers();
  const [draft, setDraft] = useState<DraftTier[]>(() =>
    tiers.map((tier) => ({
      fromMonth: tier.fromMonth,
      toMonth: tier.toMonth,
      monthlyRate: tier.monthlyRate,
    })),
  );

  const update = (index: number, patch: Partial<DraftTier>) => {
    setDraft((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, ...patch } : tier,
      ),
    );
  };

  const addRow = () => {
    const last = draft.at(-1);
    setDraft((current) => [
      ...current,
      {
        fromMonth: last?.toMonth ?? last?.fromMonth ?? 0,
        toMonth: null,
        monthlyRate: 0,
      },
    ]);
  };

  const removeRow = (index: number) => {
    setDraft((current) => current.filter((_, tierIndex) => tierIndex !== index));
  };

  const save = async () => {
    for (let index = 0; index < draft.length; index += 1) {
      const tier = draft[index];
      const previous = draft[index - 1];

      if (
        !Number.isInteger(tier.fromMonth) ||
        tier.fromMonth < 0 ||
        !Number.isFinite(tier.monthlyRate) ||
        tier.monthlyRate < 0
      ) {
        toast.error("개월과 월요율은 0 이상의 숫자로 입력해 주세요");
        return;
      }
      if (
        tier.toMonth !== null &&
        (!Number.isInteger(tier.toMonth) || tier.toMonth <= tier.fromMonth)
      ) {
        toast.error("구간 끝은 시작보다 커야 합니다");
        return;
      }
      if (
        previous &&
        (previous.toMonth === null || tier.fromMonth < previous.toMonth)
      ) {
        toast.error("구간은 겹치지 않게 순서대로 입력해 주세요");
        return;
      }
    }

    const payload: LateFeeRateTierInput[] = draft.map((tier, index) => ({
      tierOrder: index + 1,
      fromMonth: tier.fromMonth,
      toMonth: tier.toMonth,
      monthlyRate: tier.monthlyRate,
    }));

    try {
      await replace.mutateAsync({ orgId, tiers: payload });
      toast.success("연체료 요율을 저장했습니다");
      onClose();
    } catch (error) {
      toast.error(error, "저장 실패");
    }
  };

  return (
    <>
      <p className="mb-3 text-xs leading-5 text-t3">
        연체 개월 구간별 월요율을 입력합니다. 끝 개월을 비우면 이후 모든 개월에 적용됩니다.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-t3">
              <th scope="col" className="py-2 font-semibold">
                시작(초과)
              </th>
              <th scope="col" className="py-2 font-semibold">
                끝(이하)
              </th>
              <th scope="col" className="py-2 font-semibold">
                월요율(%)
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">행 작업</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.map((tier, index) => {
              const rowNumber = index + 1;
              return (
                <tr key={index} className="border-t border-line2">
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`${rowNumber}번 구간 시작 개월`}
                      className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right text-t1"
                      value={tier.fromMonth}
                      onChange={(event) =>
                        update(index, { fromMonth: Number(event.target.value) })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`${rowNumber}번 구간 끝 개월`}
                      placeholder="무한"
                      className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right text-t1"
                      value={tier.toMonth ?? ""}
                      onChange={(event) =>
                        update(index, {
                          toMonth:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      aria-label={`${rowNumber}번 구간 월요율`}
                      className="h-9 w-24 rounded-lg border border-line bg-surface px-2 text-right text-t1"
                      value={tier.monthlyRate}
                      onChange={(event) =>
                        update(index, { monthlyRate: Number(event.target.value) })
                      }
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      aria-label={`${rowNumber}번 구간 삭제`}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-danger hover:bg-red-t"
                      onClick={() => removeRow(index)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLoading && <p role="status" aria-label="연체요율표 불러오는 중" className="mt-3 text-xs text-t3">요율표를 불러오는 중입니다.</p>}
      {isError && (
        <p role="alert" className="mt-3 text-xs font-semibold text-danger">
          요율표를 불러오지 못했습니다. 모달을 닫고 다시 시도해 주세요.
        </p>
      )}
      {!isLoading && !isError && draft.length === 0 && (
        <p className="mt-3 text-xs text-t3">등록된 요율 구간이 없습니다.</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={addRow}
          disabled={isLoading || isError || replace.isPending}
        >
          구간 추가
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={replace.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={isLoading || isError || replace.isPending}
          >
            {replace.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </>
  );
}
