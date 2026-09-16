import BottomNav from "@/app/(resident)/_components/BottomNav";

import { getResidentBillPageData } from "./data";
import ResidentBillHistory from "./ResidentBillHistory";
import ResidentBillRetryState from "./ResidentBillRetryState";
import { billClasses as styles } from "./billClasses";

export default async function ResidentBillPage() {
  let pageData: Awaited<ReturnType<typeof getResidentBillPageData>>;
  try {
    pageData = await getResidentBillPageData();
  } catch {
    return (
      <ResidentBillRetryState
        className={styles.center}
        message="관리비 내역을 불러오지 못했어요"
      />
    );
  }

  if (!pageData.link) return null;

  return (
    <div className={styles.page}>
      <ResidentBillHistory
        buildingName={pageData.link.buildingName}
        unitNo={pageData.link.unitNo}
        months={pageData.months}
      />
      <BottomNav />
    </div>
  );
}
