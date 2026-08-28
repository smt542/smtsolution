import { Button, Modal, DetailField, DetailSection } from "@/components/common";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import { formatDate, formatWon } from "../utils";

export function OverdueDetailModal({
  household,
  onClose,
}: {
  household: OverdueHousehold | null;
  onClose: () => void;
}) {
  if (!household) return null;
  const unitLabel = [household.dong, household.unitNo].filter(Boolean).join(" ");

  return (
    <Modal open title={`${unitLabel} 상세`} onClose={onClose}>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        <DetailSection title="세대 정보">
          <DetailField label="건물" value={household.buildingName} />
          <DetailField label="호실" value={unitLabel} />
          <DetailField label="주소" value={household.buildingAddress || "—"} />
          <DetailField
            label="면적 / 방 수"
            value={`${household.areaPyeong ?? "—"}평 / ${household.roomCount ?? "—"}개`}
          />
        </DetailSection>

        <DetailSection title="입주자 정보">
          <DetailField label="입주자" value={household.tenantName || "미등록"} />
          <DetailField label="납부자" value={household.payerName || "—"} />
          <DetailField label="연락처" value={household.phone || "—"} />
          <DetailField label="거주 인원" value={household.residentCount != null ? `${household.residentCount}명` : "—"} />
        </DetailSection>

        <DetailSection title="입주 정보">
          <DetailField label="입주일" value={formatDate(household.moveInDate)} />
          <DetailField label="퇴실일" value={formatDate(household.moveOutDate)} />
          <DetailField label="차량번호" value={household.vehicleNo || "—"} />
          <DetailField label="상태" value={household.status === "occupied" ? "입주" : household.status === "moving_out" ? "퇴실 예정" : "공실"} />
        </DetailSection>

        <DetailSection title="미납 정보">
          <DetailField label="연체 개월수" value={`${household.overdueMonths}개월`} />
          <DetailField label="미납금액" value={formatWon(household.overdueAmount)} />
          <DetailField label="최근 납부일" value={formatDate(household.lastPaymentDate)} />
          <DetailField label="데이터 상태" value={household.billingAvailable ? "확정 부과 있음" : "확정 부과 없음"} />
        </DetailSection>

        {household.lateFeeByPeriod && household.lateFeeByPeriod.length > 0 && (
          <section className="rounded-xl border border-line bg-bg/60 p-4">
            <h3 className="text-sm font-extrabold text-t1">연체료 내역</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="text-left text-t3">
                    <th scope="col" className="py-1 font-semibold">월분</th>
                    <th scope="col" className="py-1 text-right font-semibold">연체개월</th>
                    <th scope="col" className="py-1 text-right font-semibold">누적요율</th>
                    <th scope="col" className="py-1 text-right font-semibold">연체료</th>
                  </tr>
                </thead>
                <tbody>
                  {household.lateFeeByPeriod.map((row) => (
                    <tr key={row.period} className="border-t border-line2">
                      <td className="py-2">{row.period.slice(0, 7)}</td>
                      <td className="py-2 text-right">{row.months}개월</td>
                      <td className="py-2 text-right">{row.cumulativeRatePct.toFixed(1)}%</td>
                      <td className="py-2 text-right">{formatWon(row.lateFee)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-bold">
                    <th scope="row" colSpan={3} className="py-2 text-left">합계</th>
                    <td className="py-2 text-right">
                      {formatWon(household.lateFeeAmount ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {(household.memo || household.unitMemo) && (
          <DetailSection title="관리 메모">
            <DetailField label="입주 메모" value={household.memo || "—"} />
            <DetailField label="호실 메모" value={household.unitMemo || "—"} />
          </DetailSection>
        )}
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>닫기</Button>
      </div>
    </Modal>
  );
}

