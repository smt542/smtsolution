"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { usePublicSettlementByToken } from "@/hooks/reactquery/residentSettlement";

import styles from "../../share.module.css";

const formatDate = (value: string) => value.replaceAll("-", ".");
const formatAmount = (value: number) =>
  `${value.toLocaleString("ko-KR")}원`;

export default function PublicSettlementPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const settlementQuery = usePublicSettlementByToken(token);

  if (settlementQuery.isPending) {
    return (
      <div className={styles.center} role="status">
        이사정산 내역을 불러오고 있어요.
      </div>
    );
  }

  if (settlementQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>이사정산 내역을 불러오지 못했어요.</b>
        <button type="button" onClick={() => void settlementQuery.refetch()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!settlementQuery.data) {
    return (
      <div className={styles.center} role="alert">
        <b>유효하지 않은 링크예요.</b>
        <p>공유 링크를 다시 확인해 주세요.</p>
      </div>
    );
  }

  if (settlementQuery.data.isExpired) {
    return (
      <div className={styles.center} role="alert">
        <b>만료된 링크예요.</b>
        <p>관리사무소에 새 링크를 요청해 주세요.</p>
      </div>
    );
  }

  const settlement = settlementQuery.data;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>관리비ON</span>
        <span>공개 이사정산 내역</span>
      </header>
      <main className={styles.scroll}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>이사정산</p>
          <h1 className={styles.title}>정산 내역</h1>
          <p className={styles.meta}>
            {[settlement.buildingName, settlement.unitLabel]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
        </article>
        <Link className={styles.cta} href="/resident/login">
          관리비ON 시작하기
        </Link>
      </main>
    </div>
  );
}
