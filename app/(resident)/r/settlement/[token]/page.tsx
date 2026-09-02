"use client";

import { useParams } from "next/navigation";

import PublicShareArticleCard from "@/app/(resident)/_components/PublicShareArticleCard";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { usePublicSettlementByToken } from "@/hooks/reactquery/residentSettlement";
import { formatDate as formatDateValue, formatWon } from "@/lib/format";

import styles from "../../share.module.css";

const formatDate = (value: string) => formatDateValue(value);
const formatAmount = (value: number) => formatWon(value);

export default function PublicSettlementPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const settlementQuery = usePublicSettlementByToken(token);

  if (settlementQuery.isPending) {
    return (
      <ResidentAsyncState
        variant="public"
        role="status"
        message="이사정산 내역을 불러오고 있어요."
      />
    );
  }

  if (settlementQuery.error) {
    return (
      <ResidentAsyncState
        variant="public"
        role="alert"
        message={<b>이사정산 내역을 불러오지 못했어요.</b>}
        retryLabel="다시 시도"
        onRetry={() => void settlementQuery.refetch()}
      />
    );
  }

  if (!settlementQuery.data) {
    return (
      <ResidentAsyncState
        variant="public"
        role="alert"
        message={
          <>
            <b>유효하지 않은 링크예요.</b>
            <p>공유 링크를 다시 확인해 주세요.</p>
          </>
        }
      />
    );
  }

  if (settlementQuery.data.isExpired) {
    return (
      <ResidentAsyncState
        variant="public"
        role="alert"
        message={
          <>
            <b>만료된 링크예요.</b>
            <p>관리사무소에 새 링크를 요청해 주세요.</p>
          </>
        }
      />
    );
  }

  const settlement = settlementQuery.data;

  return (
    <PublicTokenPageShell
      brand="관리비ON"
      subtitle="공개 이사정산 내역"
      ctaLabel="관리비ON 시작하기"
    >
      <PublicShareArticleCard
        eyebrow="이사정산"
        title="정산 내역"
        metadata={[settlement.buildingName, settlement.unitLabel]
          .filter(Boolean)
          .join(" · ")}
      >
        <dl className={styles.details}>
          <div className={styles.detailRow}>
            <dt>퇴실일</dt>
            <dd>
              {settlement.moveOutDate
                ? formatDate(settlement.moveOutDate)
                : "-"}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>정산구분</dt>
            <dd>{settlement.settlementKind ?? "-"}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>정산금액</dt>
            <dd className={styles.amount}>
              {settlement.settlementAmount === null
                ? "-"
                : formatAmount(settlement.settlementAmount)}
            </dd>
          </div>
        </dl>
      </PublicShareArticleCard>
    </PublicTokenPageShell>
  );
}
