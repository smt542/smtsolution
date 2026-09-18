"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useMessageLogs, type MessageLog } from "@/hooks/reactquery/messaging";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { MessageDetailModal } from "./MessageDetailModal";
import { MessageResultBadge } from "./MessageResultBadge";
import { MessagingListCard } from "./MessagingListCard";
import {
  buildRecipientSummary,
  channelLabel,
  formatMessageDateTime,
  messageResultMeta,
  senderLabel,
  truncateBody,
} from "./messageFormat";
import { SegmentedFilter } from "./SegmentedFilter";

type StatusFilter = "all" | "done" | "failed" | "scheduled";
type SortOrder = "newest" | "oldest";

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-[#8b95a1] whitespace-nowrap";
const TD =
  "h-[47.8px] px-[16px] py-[12px] text-[13px] font-medium leading-[normal] text-[#191f28]";

export function HistoryTab() {
  const { data: logs = [], isLoading, isFetching, error, refetch } = useMessageLogs();
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);
  const { data: buildings = [] } = useBuildings();
  const isRefreshing = isFetching && !isLoading;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selected, setSelected] = useState<MessageLog | null>(null);

  const buildingNameById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name] as const)),
    [buildings],
  );

  const filteredLogs = useMemo(() => {
    const result = logs.filter((log) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "done") return log.result === "sent";
      if (statusFilter === "failed") return log.result === "failed" || log.result === "partial";
      return log.isScheduled;
    });

    return [...result].sort((a, b) => {
      const aTime = new Date(a.sentAt).getTime();
      const bTime = new Date(b.sentAt).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
  }, [logs, sortOrder, statusFilter]);

  const openLog = (log: MessageLog) => setSelected(log);
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, log: MessageLog) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLog(log);
    }
  };

  return (
    <MessagingListCard
      title="발송 내역"
      count={filteredLogs.length}
      refreshing={isRefreshing}
      refreshingLabel="발송 내역 갱신 중"
      isLoading={isLoading}
      loadingLabel="발송 내역 불러오는 중"
      error={error}
      errorMessage="발송 내역을 불러오지 못했습니다."
      onRetry={() => void refetch()}
      isEmpty={filteredLogs.length === 0}
      emptyMessage="발송 내역이 없습니다."
      actions={
        <>
          <SegmentedFilter
            ariaLabel="상태 필터"
            options={[
              { value: "all", label: "전체" },
              { value: "done", label: "완료" },
              { value: "failed", label: "실패" },
              { value: "scheduled", label: "예약" },
            ]}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
          />
          <SegmentedFilter
            ariaLabel="정렬"
            options={[
              { value: "newest", label: "최신순" },
              { value: "oldest", label: "과거순" },
            ]}
            value={sortOrder}
            onChange={(value) => setSortOrder(value)}
          />
        </>
      }
    >
      <table className="w-full min-w-[1180px] border-collapse">
        <thead>
          <tr className="border-b border-[#e8ebee] bg-[#fbfcfd]">
            <th className={`${TH} w-[125px]`}>채널</th>
            <th className={`${TH} w-[232px]`}>발신자</th>
            <th className={`${TH} w-[320px]`}>수신자</th>
            <th className={TH}>내용</th>
            <th className={`${TH} w-[104px]`}>유형</th>
            <th className={`${TH} w-[134px]`}>상태</th>
            <th className={`${TH} w-[272px]`}>발송 일시</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log) => {
            const sentAt = formatMessageDateTime(log.sentAt);
            const rowLabel = `${channelLabel(log.channel)} ${sentAt} 발송 상세 보기`;

            return (
              <tr
                key={log.id}
                tabIndex={0}
                aria-label={rowLabel}
                onClick={() => openLog(log)}
                onKeyDown={(event) => handleRowKeyDown(event, log)}
                className="cursor-pointer border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fbfcfd]"
              >
                <td className={TD}>{channelLabel(log.channel)}</td>
                <td className={TD}>{senderLabel(log.channel, config?.smsSender)}</td>
                <td className={TD}>
                  {buildRecipientSummary(log.recipients, log.recipientCount, buildingNameById)}
                </td>
                <td className={`${TD} max-w-[260px]`}>
                  <span className="block truncate" title={log.body}>
                    {truncateBody(log.body)}
                  </span>
                </td>
                <td className={TD}>{log.isScheduled ? "예약" : "즉시"}</td>
                <td className={TD}>
                  <MessageResultBadge result={log.result} />
                </td>
                <td className={TD}>{sentAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <MessageDetailModal
          title="발송 상세"
          channel={selected.channel}
          rows={[
            {
              label: "수신자",
              value: buildRecipientSummary(
                selected.recipients,
                selected.recipientCount,
                buildingNameById,
              ),
            },
            { label: "발송시점", value: formatMessageDateTime(selected.sentAt) },
            { label: "유형", value: selected.isScheduled ? "예약" : "즉시" },
            { label: "상태", value: messageResultMeta(selected.result).label },
          ]}
          recipients={selected.recipients}
          recipientCount={selected.recipientCount}
          body={selected.body}
          onClose={() => setSelected(null)}
        />
      )}
    </MessagingListCard>
  );
}
