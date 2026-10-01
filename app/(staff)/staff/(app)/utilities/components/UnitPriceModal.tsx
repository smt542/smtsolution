import { useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Modal, Spinner } from "@/components/common";
import {
  useSaveScopedPrices,
  useSaveUtilityUnitPrices,
  useScopedPrices,
  useUtilityPrices,
  type ScopedUsageType,
  type UtilityType,
} from "@/hooks/reactquery/utilities";

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

const USAGE_TYPES = ["residential", "commercial"] as const;
const USAGE_LABELS: Record<ScopedUsageType, string> = {
  residential: "주거",
  commercial: "상가",
};

interface ScopedDraftRow {
  id: string;
  usageType: ScopedUsageType;
  floor: string;
  unitPrice: string;
}

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
  const pricesQuery = useUtilityPrices(open ? buildingId : null, utilityType);
  const scopedPricesQuery = useScopedPrices(open ? buildingId : null, utilityType);
  const savePrices = useSaveUtilityUnitPrices();
  const saveScoped = useSaveScopedPrices();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [scopedEdits, setScopedEdits] = useState<{
    scope: string;
    rows: ScopedDraftRow[];
  } | null>(null);
  const nextScopedRowId = useRef(0);
  const prices = pricesQuery.data ?? [];
  const isUnitPriceRefreshing = [pricesQuery, scopedPricesQuery]
    .some((query) => query.isFetching && !query.isLoading);
  const scopedScope = `${buildingId ?? "none"}:${utilityType}`;
  const loadedScopedRows: ScopedDraftRow[] = (scopedPricesQuery.data ?? []).map((row) => ({
    id: `saved:${row.usage_type}:${row.floor ?? "all"}`,
    usageType: row.usage_type,
    floor: row.floor === null ? "" : String(row.floor),
    unitPrice: String(row.unit_price),
  }));
  const scopedRows = scopedEdits?.scope === scopedScope
    ? scopedEdits.rows
    : loadedScopedRows;

  const setPrice = (customerNumberId: number, value: string) => {
    setDrafts((current) => ({ ...current, [customerNumberId]: value }));
  };

  const priceText = (customerNumberId: number, unitPrice: number | null) =>
    drafts[customerNumberId] ?? (unitPrice === null ? "" : String(unitPrice));

  const editScopedRows = (edit: (rows: ScopedDraftRow[]) => ScopedDraftRow[]) => {
    setScopedEdits((current) => ({
      scope: scopedScope,
      rows: edit(current?.scope === scopedScope ? current.rows : loadedScopedRows),
    }));
  };

  const addScopedRow = (usageType: ScopedUsageType) => {
    editScopedRows((rows) => [
      ...rows,
      {
        id: `new:${++nextScopedRowId.current}`,
        usageType,
        floor: "",
        unitPrice: "",
      },
    ]);
  };

  const updateScopedRow = (
    id: string,
    field: "floor" | "unitPrice",
    value: string,
  ) => {
    editScopedRows((rows) => rows.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
  };

  const removeScopedRow = (id: string) => {
    editScopedRows((rows) => rows.filter((row) => row.id !== id));
  };

  const close = () => {
    setDrafts({});
    setScopedEdits(null);
    onClose();
  };

  const submit = () => {
    if (buildingId === null) return;
    const filled = prices
      .map((row) => ({
        row,
        value: priceText(row.customerNumberId, row.unitPrice).trim(),
      }))
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
          close();
        },
        onError: (error) => {
          toast.error(error, "단가 저장에 실패했습니다.");
        },
      },
    );
  };

  const submitScoped = () => {
    if (buildingId === null) return;
    const orderedRows = USAGE_TYPES.flatMap((usageType) => (
      scopedRows.filter((row) => row.usageType === usageType)
    ));
    if (orderedRows.length === 0) {
      toast.error("저장할 용도/층별 단가 행을 추가해 주세요.");
      return;
    }

    const parsedRows = orderedRows.map((row) => {
      const floorText = row.floor.trim();
      return {
        usage_type: row.usageType,
        floor: floorText === "" ? null : Number(floorText),
        unit_price: Number(row.unitPrice.trim()),
        unitPriceText: row.unitPrice.trim(),
      };
    });
    const invalid = parsedRows.some((row) => (
      row.unitPriceText === ""
      || !Number.isFinite(row.unit_price)
      || row.unit_price < 0
      || (row.floor !== null && (
        !Number.isInteger(row.floor)
        || row.floor < -2147483648
        || row.floor > 2147483647
      ))
    ));
    if (invalid) {
      toast.error("층은 정수, 단가는 0 이상의 숫자로 입력해 주세요.");
      return;
    }

    const scopes = parsedRows.map((row) => `${row.usage_type}:${row.floor ?? "all"}`);
    if (new Set(scopes).size !== scopes.length) {
      toast.error("같은 용도와 층의 단가는 한 행만 입력해 주세요.");
      return;
    }

    saveScoped.mutate(
      {
        buildingId,
        utilityType,
        rows: parsedRows.map(({ usage_type, floor, unit_price }) => ({
          usage_type,
          floor,
          unit_price,
        })),
      },
      {
        onSuccess: (result) => {
          toast.success(`${result.saved}개 용도/층별 단가를 저장했습니다.`);
          close();
        },
        onError: (error) => {
          toast.error(error, "용도/층별 단가 저장에 실패했습니다.");
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`${TYPE_LABELS[utilityType]} 단가 설정`}
    >
      <div className="relative max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        {isUnitPriceRefreshing ? (
          <div className="sticky top-0 z-10 ml-auto w-fit rounded-lg bg-white/95 shadow-card">
            <Spinner label="단가 정보 갱신 중" size="small" showLabel className="px-3 py-2" />
          </div>
        ) : null}
        <section aria-labelledby="customer-price-heading">
          <h3 id="customer-price-heading" className="text-sm font-extrabold text-t1">
            고객번호별 단가
          </h3>
          <p className="mb-4 mt-1 text-sm text-t3">
            건물에 등록된 고객번호별 단가를 설정합니다.
          </p>

          {pricesQuery.isLoading && (
            <div className="min-h-[160px] py-8">
              <Spinner label="고객번호별 단가 불러오는 중" showLabel />
            </div>
          )}

          {pricesQuery.error && (
            <p role="alert" className="rounded-xl border border-red/20 bg-red-t p-4 text-sm font-semibold text-red">
              단가 목록을 불러오지 못했습니다.
            </p>
          )}

          {!pricesQuery.isLoading && !pricesQuery.error && prices.length === 0 && (
            <p className="rounded-xl border border-line bg-bg p-5 text-center text-sm text-t3">
              건물 상세에서 고객번호를 먼저 등록해 주세요.
            </p>
          )}

          {prices.length > 0 && (
            <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
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
                  <Input
                    unstyled
                    aria-label={`${row.customerNo} 단가`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceText(row.customerNumberId, row.unitPrice)}
                    placeholder="단가"
                    onChange={(event) => setPrice(row.customerNumberId, event.target.value)}
                    className="num h-10 w-full rounded-lg border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-brand focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              onClick={submit}
              disabled={savePrices.isPending || prices.length === 0}
            >
              저장
            </Button>
          </div>
        </section>

        <section aria-labelledby="scoped-price-heading" className="border-t border-line pt-6">
          <h3 id="scoped-price-heading" className="text-sm font-extrabold text-t1">
            용도/층별 단가
          </h3>
          <p className="mb-4 mt-1 text-sm text-t3">
            층을 비우면 해당 용도 전체에 적용됩니다.
          </p>

          {scopedPricesQuery.isLoading && (
            <div className="min-h-[160px] py-8">
              <Spinner label="용도·층별 단가 불러오는 중" showLabel />
            </div>
          )}

          {scopedPricesQuery.error && (
            <p role="alert" className="rounded-xl border border-red/20 bg-red-t p-4 text-sm font-semibold text-red">
              용도/층별 단가 목록을 불러오지 못했습니다.
            </p>
          )}

          {!scopedPricesQuery.isLoading && !scopedPricesQuery.error && (
            <div className="space-y-4">
              {USAGE_TYPES.map((usageType) => {
                const usageRows = scopedRows.filter((row) => row.usageType === usageType);
                const usageLabel = USAGE_LABELS[usageType];
                return (
                  <section key={usageType} className="rounded-xl border border-line p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-extrabold text-t1">{usageLabel}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`${usageLabel} 행 추가`}
                        onClick={() => addScopedRow(usageType)}
                        className="h-9 px-3"
                      >
                        행 추가
                      </Button>
                    </div>

                    {usageRows.length === 0 && (
                      <p className="py-2 text-center text-xs text-t3">등록된 단가가 없습니다.</p>
                    )}

                    <div className="space-y-2">
                      {usageRows.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-2"
                        >
                          <Input
                            unstyled
                            aria-label={`${usageLabel} ${index + 1} 층`}
                            type="number"
                            step="1"
                            value={row.floor}
                            placeholder="전체"
                            onChange={(event) => updateScopedRow(row.id, "floor", event.target.value)}
                            className="num h-10 w-full rounded-lg border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-brand focus:outline-none"
                          />
                          <Input
                            unstyled
                            aria-label={`${usageLabel} ${index + 1} 단가`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            placeholder="단가"
                            onChange={(event) => updateScopedRow(row.id, "unitPrice", event.target.value)}
                            className="num h-10 w-full rounded-lg border border-line bg-surface px-3 text-right text-sm font-bold text-t1 focus:border-brand focus:outline-none"
                          />
                          <button
                            type="button"
                            aria-label={`${usageLabel} ${index + 1}행 삭제`}
                            onClick={() => removeScopedRow(row.id)}
                            className="h-10 rounded-lg border border-line px-3 text-xs font-bold text-t3 hover:bg-bg"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              onClick={submitScoped}
              disabled={saveScoped.isPending || scopedPricesQuery.isLoading || scopedRows.length === 0}
            >
              용도/층별 단가 저장
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={close}>취소</Button>
      </div>
    </Modal>
  );
}
