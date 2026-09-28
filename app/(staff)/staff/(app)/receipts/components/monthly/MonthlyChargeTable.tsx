import { ReportTable3 } from "../report-table/ReportTable3";
import type { MonthlyReportModel } from "./monthlyChargeData";

export function MonthlyChargeTable({ model }: { model: MonthlyReportModel }) {
  // 정본 `.hf-tbl.ac-tbl`의 3줄 셀과 sticky 합계를 공용 표로 맞춘다.
  return (
    <ReportTable3
      columns={model.columns}
      rows={model.rows}
      total={model.total}
      emptyText="조회된 부과·수납 자료가 없습니다."
    />
  );
}
