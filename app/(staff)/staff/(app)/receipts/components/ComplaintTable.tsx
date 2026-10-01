import { Badge, EmptyState, PhoneText, Spinner } from "@/components/common";
import type { Account } from "@/hooks/reactquery/accounts";
import type { Complaint } from "@/hooks/reactquery/complaints";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_STYLE,
  formatComplaintDate,
  formatUnitLabel,
} from "../constants";

export function ComplaintTable({
  complaints,
  assignees,
  isLoading,
  onSelect,
}: {
  complaints: Complaint[];
  assignees: Account[];
  isLoading: boolean;
  onSelect: (complaint: Complaint) => void;
}) {
  const assigneeNames = new Map(assignees.map((account) => [account.userId, account.fullName]));

  if (isLoading) return <Spinner />;
  if (complaints.length === 0) {
    return <EmptyState message="조건에 맞는 민원·AS 접수가 없습니다" />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
            <th className="px-4 py-3">접수일</th>
            <th className="px-4 py-3">건물·호실</th>
            <th className="px-4 py-3">구분</th>
            <th className="px-4 py-3">신고자</th>
            <th className="px-4 py-3">접수내용</th>
            <th className="px-4 py-3">담당 기사</th>
            <th className="px-4 py-3">처리결과</th>
            <th className="px-4 py-3">상태</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((complaint) => {
            const latestResolution = complaint.resolutions[0];
            return (
              <tr
                key={complaint.id}
                tabIndex={0}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-row-hover focus:bg-blue-t2 focus:outline-none"
                onClick={() => onSelect(complaint)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(complaint);
                  }
                }}
              >
                <td className="whitespace-nowrap px-4 py-4 text-t2">
                  {formatComplaintDate(complaint.receivedAt)}
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold text-t1">{complaint.buildingName ?? "-"}</p>
                  <p className="mt-0.5 text-xs text-t3">
                    {formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong })}
                  </p>
                </td>
                <td className="px-4 py-4 text-t2">{complaint.categoryLabel ?? "-"}</td>
                <td className="px-4 py-4">
                  <p className="text-t1">{complaint.reporterName ?? "-"}</p>
                  <p className="mt-0.5 text-xs text-t3">
                    <PhoneText value={complaint.reporterPhone} />
                  </p>
                </td>
                <td className="max-w-xs px-4 py-4">
                  <p className="font-bold text-t1">{complaint.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-t3">
                    {complaint.content || "내용 없음"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-t2">
                  {complaint.assignedTo
                    ? assigneeNames.get(complaint.assignedTo) ?? "배정됨"
                    : "미배정"}
                </td>
                <td className="max-w-56 px-4 py-4 text-xs leading-5 text-t2">
                  <p className="line-clamp-2">
                    {latestResolution?.resultContent || "처리이력 없음"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <Badge
                    className={`inline-flex px-2.5 py-1 ${COMPLAINT_STATUS_STYLE[complaint.status]}`}
                  >
                    {COMPLAINT_STATUS_LABEL[complaint.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
