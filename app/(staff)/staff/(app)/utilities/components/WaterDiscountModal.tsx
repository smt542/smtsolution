import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, CustomDropdown, Modal } from "@/components/common";
import {
  useSaveWaterDiscount,
  useDeleteWaterDiscount,
  type UtilityUnitRow,
  type WaterDiscountType,
} from "@/hooks/reactquery/utilities";

const TYPE_OPTIONS: { value: WaterDiscountType; label: string }[] = [
  { value: "recipient", label: "수급자" },
  { value: "multichild", label: "다자녀" },
  { value: "other", label: "기타" },
];

interface WaterDiscountModalProps {
  open: boolean;
  buildingId: number;
  period: string;
  row: UtilityUnitRow | null;
  onClose: () => void;
}

export function WaterDiscountModal({ open, buildingId, period, row, onClose }: WaterDiscountModalProps) {
  const saveDiscount = useSaveWaterDiscount();
  const deleteDiscount = useDeleteWaterDiscount();
  const [discountType, setDiscountType] = useState<WaterDiscountType>(
    (row?.discountType as WaterDiscountType) ?? "recipient",
  );
  const [amount, setAmount] = useState(row?.discountAmount != null ? String(row.discountAmount) : "");
  if (!row) return null;

  const hasDiscount = row.discountType !== null;

  const submit = () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("할인 금액을 확인해 주세요.");
      return;
    }
    saveDiscount.mutate(
      { buildingId, period, unitId: row.unitId, discountType, amount: parsed },
      {
        onSuccess: () => {
          toast.success("할인을 저장했습니다.");
          onClose();
        },
        onError: () => toast.error("할인 저장에 실패했습니다."),
      },
    );
  };

  const remove = () => {
    deleteDiscount.mutate({ buildingId, period, unitId: row.unitId }, {
      onSuccess: () => {
        toast.success("할인을 해제했습니다.");
        onClose();
      },
      onError: () => toast.error("할인 해제에 실패했습니다."),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`${row.unitNo} 수도 할인 설정`}>
      <p className="mb-4 text-sm text-t3">{row.tenantName || "입주자 없음"} · 수급자·다자녀 할인</p>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-t2">할인 구분</span>
          {/* 네이티브 select 금지(QA 공통 규칙) — 트리거는 아래 할인 금액 칸과 같은 44px·r12·14px */}
          <div className="[&_.uc-dd-btn]:h-11 [&_.uc-dd-btn]:rounded-xl [&_.uc-dd-btn]:pl-4 [&_.uc-dd-btn]:pr-4 [&_.uc-dd-btn]:text-sm [&_.uc-dd-btn]:font-normal">
            <CustomDropdown
              ariaLabel="할인 구분"
              value={discountType}
              options={TYPE_OPTIONS}
              size="form"
              variant="field"
              position="fixed"
              onChange={(value) => setDiscountType(value as WaterDiscountType)}
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-t2">할인 금액</span>
          <input
            aria-label="할인 금액"
            type="number"
            min="0"
            step="1"
            value={amount}
            placeholder="원"
            onChange={(e) => setAmount(e.target.value)}
            className="num h-11 w-full rounded-xl border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-blue focus:outline-none"
          />
        </label>
        <p className="text-xs text-t4">
          할인은 검침 저장 시 이력에 기록되며, 자동요금(단가) 연동 후 요금에서 차감됩니다.
        </p>
      </div>
      <div className="mt-6 flex justify-between">
        <div>
          {hasDiscount && (
            <Button variant="danger" onClick={remove} disabled={deleteDiscount.isPending}>
              {deleteDiscount.isPending ? "할인 해제 중…" : "할인 해제"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit} disabled={saveDiscount.isPending}>
            {saveDiscount.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
