import BillDetailView from "@/app/(resident)/_components/BillDetailView";
import { billDetailPageClasses as styles } from "@/app/(resident)/_components/billDetailPageClasses";

import { getPublicBillBySigned } from "./data";
import PublicBillFrame from "./PublicBillFrame";
import PublicBillRetryState from "./PublicBillRetryState";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** URL 세그먼트의 unit_no를 안전 디코드(잘못된 %는 원문 유지). */
const decodeUnitSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export default async function PublicSignedBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ building: string; unit: string; period: string }>;
  searchParams: Promise<{ s?: string | string[]; d?: string | string[] }>;
}) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const buildingId = Number(routeParams.building);
  // 이 Next 빌드는 동적 세그먼트를 자동 디코드하지 않을 수 있다(예: "201%ED%98%B8").
  // 서명 대상 원본 unit_no("201호")로 되돌린다. 이미 디코드된 값은 no-op이다.
  const unitNo = routeParams.unit ? decodeUnitSegment(routeParams.unit) : "";
  const period = routeParams.period ?? "";
  const sigValue = query.s;
  const sig = Array.isArray(sigValue) ? (sigValue[0] ?? "") : (sigValue ?? "");
  const issuedDayValue = query.d;
  const issuedDayText = Array.isArray(issuedDayValue)
    ? (issuedDayValue[0] ?? "")
    : (issuedDayValue ?? "");
  const issuedDay = issuedDayText ? Number(issuedDayText) : undefined;
  const paramsValid =
    Number.isInteger(buildingId) &&
    buildingId > 0 &&
    Boolean(unitNo) &&
    PERIOD_PATTERN.test(period) &&
    Boolean(sig) &&
    (issuedDay === undefined || (Number.isInteger(issuedDay) && issuedDay >= 0));

  let detail: Awaited<ReturnType<typeof getPublicBillBySigned>> = null;
  if (paramsValid) {
    try {
      detail = await getPublicBillBySigned(buildingId, unitNo, period, sig, issuedDay);
    } catch {
      return (
        <PublicBillFrame>
          <PublicBillRetryState />
        </PublicBillFrame>
      );
    }
  }

  // 건물·호수 줄·앱 안내 카드·열람 안내는 BillDetailView(public 모드)가 정본대로 그린다.
  return (
    <PublicBillFrame>
      <main className={styles.scroll}>
        <BillDetailView mode="public" detail={detail} />
      </main>
    </PublicBillFrame>
  );
}
