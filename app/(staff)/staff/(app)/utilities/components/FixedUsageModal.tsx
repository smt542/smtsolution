import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Modal } from "@/components/common";
import {
  useClearFixedUsage,
  useSetFixedUsage,
  type UtilityType,
} from "@/hooks/reactquery/utilities";

interface FixedUsageModalProps {
  open: boolean;
  buildingId: number;
  unitId: number;
  unitNo: string;
  utility: UtilityType;
  currentFixedUsage: number | null;
  currentFixedUsageFrom?: string | null;
  onSaved: () => void;
  onClose: () => void;
}

export function FixedUsageModal({
  open,
  buildingId,
  unitId,
  unitNo,
  utility,
  currentFixedUsage,
  currentFixedUsageFrom,
  onSaved,
  onClose,
}: FixedUsageModalProps) {
  const setFixedUsage = useSetFixedUsage();
  const clearFixedUsage = useClearFixedUsage();
  const [amount, setAmount] = useState(
    currentFixedUsage === null ? "" : String(currentFixedUsage),
  );
  const [fixedUsageFrom, setFixedUsageFrom] = useState(
    utility === "gas" ? currentFixedUsageFrom?.slice(0, 7) ?? "" : "",
  );
  const hasFixedUsage = currentFixedUsage !== null;
  const isPending = setFixedUsage.isPending || clearFixedUsage.isPending;

  const submit = () => {
    const parsed = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      toast.error("고정 사용량을 확인해 주세요.");
      return;
    }
    setFixedUsage.mutate(
      {
        buildingId,
        unitId,
        utilityType: utility,
        fixedUsage: parsed,
        ...(utility === "gas"
          ? { fixedUsageFrom: fixedUsageFrom ? `${fixedUsageFrom}-01` : null }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success("고정 사용량을 저장했습니다.");
          onSaved();
        },
        onError: () => toast.error("고정 사용량 저장에 실패했습니다."),
      },
    );
  };

  const remove = () => {
    clearFixedUsage.mutate(
      { buildingId, unitId, utilityType: utility },
      {
        onSuccess: () => {
          toast.success("고정 사용량을 해제했습니다.");
          onSaved();
        },
        onError: () => toast.error("고정 사용량 해제에 실패했습니다."),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={`${unitNo} 고정 사용량 설정`}>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-t2">고정 사용량</span>
          <input
            aria-label="고정 사용량"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            placeholder="사용량"
            onChange={(event) => setAmount(event.target.value)}
            className="num h-11 w-full rounded-xl border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-blue focus:outline-none"
          />
        </label>
        {utility === "gas" && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-t2">적용 시작월</span>
            <input
              aria-label="적용 시작월"
              type="month"
              value={fixedUsageFrom}
              onChange={(event) => setFixedUsageFrom(event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-t1 focus:border-blue focus:outline-none"
            />
          </label>
        )}
        <p className="text-xs text-t4">
          설정하면 당월 지침값 대신 고정 사용량으로 부과 계산합니다.
        </p>
      </div>
      <div className="mt-6 flex justify-between">
        <div>
          {hasFixedUsage && (
            <Button variant="danger" onClick={remove} disabled={isPending}>
              고정 사용량 해제
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={isPending}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}
