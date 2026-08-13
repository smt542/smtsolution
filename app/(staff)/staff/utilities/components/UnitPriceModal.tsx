import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Spinner } from "@/components/common";
import {
  useSaveUtilityUnitPrices,
  useUtilityPrices,
  type UtilityType,
} from "@/hooks/reactquery/utilities";

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

interface UnitPriceModalProps {
  open: boolean;
  buildingId: number | null;
  utilityType: UtilityType;
  onClose: () => void;
}

export function UnitPriceModal({
  open,
  buildingId,
  utilityType,
  onClose,
}: UnitPriceModalProps) {
  const pricesQuery = useUtilityPrices(buildingId, utilityType);
  const savePrices = useSaveUtilityUnitPrices();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const prices = pricesQuery.data ?? [];

  useEffect(() => {
    setDrafts(Object.fromEntries(
      prices.map((row) => [
        row.customerNumberId,
        row.unitPrice === null ? "" : String(row.unitPrice),
      ]),
    ));
  }, [pricesQuery.data]);

  const setPrice = (customerNumberId: number, value: string) => {
    setDrafts((current) => ({ ...current, [customerNumberId]: value }));
  };

  const submit = () => {
    if (buildingId === null) return;
    const filled = prices
      .map((row) => ({ row, value: (drafts[row.customerNumberId] ?? "").trim() }))
      .filter(({ value }) => value !== "");
    const invalid = filled.some(({ value }) => {
      const parsed = Number(value);
      return !Number.isFinite(parsed) || parsed < 0;
    });
    if (invalid) {
      toast.error("단가는 0 이상의 숫자로 입력해 주세요.");
      return;
    }
    if (filled.length === 0) {
      toast.error("저장할 단가를 입력해 주세요.");
      return;
    }

    savePrices.mutate(
      {
        buildingId,
        utilityType,
        prices: filled.map(({ row, value }) => ({
          customer_number_id: row.customerNumberId,
          unit_price: Number(value),
        })),
      },
      {
        onSuccess: (result) => {
          toast.success(`${result.saved}개 고객번호 단가를 저장했습니다.`);
          onClose();
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "단가 저장에 실패했습니다.");
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${TYPE_LABELS[utilityType]} 단가 설정`}
    >
      <p className="mb-4 text-sm text-t3">
        건물에 등록된 고객번호별 단가를 설정합니다.
      </p>

      {pricesQuery.isLoading && (
        <div className="py-8">
          <Spinner />
          <p className="text-center text-sm text-t3">단가를 불러오는 중입니다.</p>
        </div>
      )}

      {pricesQuery.error && (
        <p className="rounded-xl border border-red/20 bg-red-t p-4 text-sm font-semibold text-red">
          단가 목록을 불러오지 못했습니다.
        </p>
      )}

      {!pricesQuery.isLoading && !pricesQuery.error && prices.length === 0 && (
        <p className="rounded-xl border border-line bg-bg p-5 text-center text-sm text-t3">
          건물 상세에서 고객번호를 먼저 등록해 주세요.
        </p>
      )}

      {prices.length > 0 && (
        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {prices.map((row) => (
            <label
              key={row.customerNumberId}
              className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3 rounded-xl border border-line p-3"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm text-t1">{row.customerNo}</strong>
                <small className="block truncate text-xs text-t3">
                  {row.holderName ?? "명의 미등록"}
                </small>
              </span>
              <input
                aria-label={`${row.customerNo} 단가`}
                type="number"
                min="0"
                step="0.01"
                value={drafts[row.customerNumberId] ?? ""}
                placeholder="단가"
                onChange={(event) => setPrice(row.customerNumberId, event.target.value)}
                className="num h-10 w-full rounded-lg border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-brand focus:outline-none"
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button
          onClick={submit}
          disabled={savePrices.isPending || prices.length === 0}
        >
          저장
        </Button>
      </div>
    </Modal>
  );
}
