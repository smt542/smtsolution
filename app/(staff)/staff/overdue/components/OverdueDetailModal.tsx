import { Button, Modal } from "@/components/common";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import { formatDate, formatWon } from "../utils";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-t3">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-t1">{value || "—"}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-bg/60 p-4">
      <h3 className="mb-3 text-sm font-extrabold text-t1">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

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

