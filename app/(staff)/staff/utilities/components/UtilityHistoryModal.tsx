import { Button, Modal } from "@/components/common";
import { useMeterHistory, type UtilityType, type UtilityUnitRow } from "@/hooks/reactquery/utilities";

const TYPE_LABELS: Record<UtilityType, string> = {
  water: "수도",
  electricity: "전기",
  gas: "가스",
};

interface UtilityHistoryModalProps {
  open: boolean;
  row: UtilityUnitRow | null;
  utilityType: UtilityType;
  referenceDate: string;
  onClose: () => void;
}

function ym(period: string): string {
  return `${period.slice(0, 4)}.${period.slice(5, 7)}`;
}
function formatCharge(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("ko-KR");
}
function formatDelta(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ko-KR")}`;
}

export function UtilityHistoryModal({
  open,
  row,
  utilityType,
  referenceDate,
  onClose,
}: UtilityHistoryModalProps) {
  const period = `${referenceDate.slice(0, 7)}-01`;
  const historyQuery = useMeterHistory(row?.unitId ?? null, utilityType, period);
  if (!row) return null;

  const history = historyQuery.data ?? [];
  // 최신→과거. 전월 대비 증감 = 현재 charge − 바로 다음(과거) 행 charge.
  const rows = history.map((item, index) => {
    const prev = history[index + 1];
    const delta =
      item.charge !== null && prev && prev.charge !== null ? item.charge - prev.charge : null;
    return { ...item, delta };
  });

  return (
    <Modal open={open} onClose={onClose} title={`${row.unitNo} ${TYPE_LABELS[utilityType]} 6개월 이력`}>
      <p className="mb-4 text-sm text-t3">{row.tenantName || "입주자 없음"} · 최근 6개월</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs font-bold text-t3">
              <th className="px-3 py-3 text-left">월</th>
              <th className="px-3 py-3 text-right">부과액</th>
              <th className="px-3 py-3 text-right">전월 대비 증감</th>
              <th className="px-3 py-3 text-right">단가</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-t4">
                  검침 이력이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((item) => (
              <tr key={item.period} className="border-b border-line2 last:border-b-0">
                <td className="num px-3 py-3 font-semibold">{ym(item.period)}</td>
                <td className="num px-3 py-3 text-right text-t1">{formatCharge(item.charge)}</td>
                <td className="num px-3 py-3 text-right text-t3">{formatDelta(item.delta)}</td>
                <td className="num px-3 py-3 text-right text-t3">
                  {item.unitPrice === null ? "—" : item.unitPrice.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-t4">단가·자동요금은 단가 연동 후 표시됩니다.</p>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}
