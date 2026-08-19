"use client";

import type {
  PublicBillDetail,
  ResidentBillDetail,
} from "@/hooks/reactquery/residentBilling";

import CopyButton from "./CopyButton";
import styles from "./BillDetailView.module.css";

type BillDetailViewProps =
  | { mode: "authed"; detail: ResidentBillDetail }
  | { mode: "public"; detail: PublicBillDetail | null };

const formatAmount = (amount: number | null) =>
  `${(amount ?? 0).toLocaleString("ko-KR")}원`;

const formatPeriod = (period: string) => period.slice(0, 7).replace("-", ".");

const formatDate = (date: string | null) =>
  date ? date.slice(0, 10).replaceAll("-", ".") : "-";

export default function BillDetailView(props: BillDetailViewProps) {
  if (props.mode === "public" && !props.detail) {
    return (
      <div className={styles.state} role="status">
        <b>유효하지 않은 링크</b>
        <span>링크 주소를 다시 확인해 주세요.</span>
      </div>
    );
  }

  if (props.mode === "public" && props.detail?.isExpired) {
    return (
      <div className={styles.state} role="status">
        <b>만료된 링크입니다</b>
        <span>새 공유 링크를 요청해 주세요.</span>
      </div>
    );
  }

  const detail = props.detail;
  if (!detail) return null;

  const paymentAmount =
    (detail.unpaidAmount ?? 0) > 0
      ? (detail.unpaidAmount ?? 0)
      : (detail.totalAmount ?? 0);
  const account =
    detail.mgmtBank && detail.mgmtAcct
      ? `${detail.mgmtBank} ${detail.mgmtAcct}`
      : "";
  const accountWithAmount = `${account} ${paymentAmount.toLocaleString("ko-KR")}원`.trim();

  return (
    <article className={styles.detail}>
      <section className={styles.hero}>
        <p className={styles.unit}>
          {detail.buildingName} {detail.unitNo}
        </p>
        {props.mode === "authed" && props.detail.tenantName ? (
          <p className={styles.tenant}>{props.detail.tenantName} 님</p>
        ) : null}
        <h1>{formatPeriod(detail.period)} 관리비</h1>
        <div className={styles.amounts}>
          <div>
            <span>합계</span>
            <b>{formatAmount(detail.totalAmount)}</b>
          </div>
          <div>
            <span>납부</span>
            <b>{formatAmount(detail.paidAmount)}</b>
          </div>
          <div className={styles.unpaid}>
            <span>미납</span>
            <b>{formatAmount(detail.unpaidAmount)}</b>
          </div>
        </div>
        <p className={styles.due}>
          <span>납기</span>
          <b>{formatDate(detail.dueDate)}</b>
        </p>
      </section>

      <section className={styles.card} aria-labelledby="bill-items-title">
        <h2 id="bill-items-title">부과 항목</h2>
        {detail.items.length > 0 ? (
          <ul className={styles.items}>
            {detail.items.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <b>{formatAmount(item.amount)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>등록된 항목이 없습니다.</p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="deposit-account-title">
        <h2 id="deposit-account-title">입금 계좌</h2>
        {account ? (
          <>
            <dl className={styles.account}>
              <div>
                <dt>은행</dt>
                <dd>{detail.mgmtBank ?? "-"}</dd>
              </div>
              <div>
                <dt>계좌번호</dt>
                <dd>{detail.mgmtAcct ?? "-"}</dd>
              </div>
              <div>
                <dt>예금주</dt>
                <dd>{detail.mgmtHolder ?? "-"}</dd>
              </div>
            </dl>
            <div className={styles.copyActions}>
              <CopyButton
                text={account}
                label="계좌 복사"
                className={styles.copyButton}
              />
              <CopyButton
                text={accountWithAmount}
                label="계좌·금액 복사"
                className={`${styles.copyButton} ${styles.primary}`}
              />
            </div>
          </>
        ) : (
          <p className={styles.empty}>등록된 계좌가 없습니다.</p>
        )}
      </section>
    </article>
  );
}
