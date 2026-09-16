import BillDetailView from "@/app/(resident)/_components/BillDetailView";

import { getResidentBillDetail } from "../data";
import ResidentBillRetryState from "../ResidentBillRetryState";
import { billDetailPageClasses as styles } from "./detailClasses";
import ResidentBillBackButton from "./ResidentBillBackButton";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026년 7월 관리비" — 정본 상단바 타이틀. period = "YYYY-MM-01". */
const monthTitle = (period: string) =>
  `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월 관리비`;

export default async function ResidentBillDetailPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period: segment } = await params;
  const period = PERIOD_PATTERN.test(segment) ? `${segment}-01` : "";

  if (!period) {
    return (
      <div className={styles.center} role="alert">
        유효하지 않은 관리비 기간입니다.
      </div>
    );
  }

  let detail: Awaited<ReturnType<typeof getResidentBillDetail>>;
  try {
    detail = await getResidentBillDetail(period);
  } catch {
    return (
      <ResidentBillRetryState
        className={styles.center}
        message="관리비 상세를 불러오지 못했어요"
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <ResidentBillBackButton />
        <h1>{monthTitle(period)}</h1>
        <span aria-hidden="true" />
      </header>

      <main className={styles.scroll}>
        {!detail ? (
          <div className={styles.empty} role="status">
            <b>부과 내역이 없어요</b>
            <span>선택한 달의 확정된 관리비가 없습니다.</span>
          </div>
        ) : (
          <BillDetailView mode="authed" detail={detail} />
        )}
      </main>
    </div>
  );
}
