import PublicShareArticleCard from "@/app/(resident)/_components/PublicShareArticleCard";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { formatDate as formatDateValue, formatWon } from "@/lib/format";

import { getPublicSettlementByToken } from "./data";
import PublicSettlementRetryState from "./PublicSettlementRetryState";
import styles from "../../share.module.css";

const formatDate = (value: string) => formatDateValue(value);
const formatAmount = (value: number) => formatWon(value);

export default async function PublicSettlementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let settlement;
  try {
    settlement = await getPublicSettlementByToken(token);
  } catch {
    return <PublicSettlementRetryState />;
  }

  if (!settlement) {
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

  if (settlement.isExpired) {
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
