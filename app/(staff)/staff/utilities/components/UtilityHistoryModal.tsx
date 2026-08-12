import { Button, Modal } from "@/components/common";
import type { UtilityType, UtilityUnitRow } from "@/hooks/reactquery/utilities";

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

function sixMonthLabels(referenceDate: string): string[] {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
    ? new Date(`${referenceDate}T00:00:00`)
    : new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(parsed.getFullYear(), parsed.getMonth() - index, 1);
    return `${month.getFullYear()}.${String(month.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function UtilityHistoryModal({
  open,
  row,
  utilityType,
  referenceDate,
  onClose,
}: UtilityHistoryModalProps) {
  if (!row) return null;

  // TODO(meter): meter_readings 조회가 가능해지면 월별 null 셀을 실제 이력으로 교체한다.
  const history = sixMonthLabels(referenceDate).map((month) => ({
    month,
    charge: null,
    chargeDelta: null,
    unitPrice: null,
    unitPriceDelta: null,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${row.unitNo} ${TYPE_LABELS[utilityType]} 6개월 이력`}
    >
      <p className="mb-4 text-sm text-t3">
        {row.tenantName || "입주자 없음"} · 최근 6개월
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg text-xs font-bold text-t3">
              <th className="px-3 py-3 text-left">월</th>
              <th className="px-3 py-3 text-right">부과액</th>
              <th className="px-3 py-3 text-right">전월 대비 증감</th>
              <th className="px-3 py-3 text-right">단가</th>
              <th className="px-3 py-3 text-right">단가 증감</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.month} className="border-b border-line2 last:border-b-0">
                <td className="num px-3 py-3 font-semibold">{item.month}</td>
                <td className="px-3 py-3 text-right text-t3">—</td>
                <td className="px-3 py-3 text-right text-t3">—</td>
                <td className="px-3 py-3 text-right text-t3">—</td>
                <td className="px-3 py-3 text-right text-t3">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-t4">검침 이력 데이터 연동 전입니다.</p>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}
