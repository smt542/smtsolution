"use client";

import { useMemo, useState } from "react";
import { useMessageLogs, type MessageLog } from "@/hooks/reactquery/messaging";
import type { SendMode } from "@/lib/messaging/preset";
import { MessageDetailModal } from "./MessageDetailModal";
import { MessagingListCard } from "./MessagingListCard";
import { SegmentedFilter } from "./SegmentedFilter";

type ChannelFilter = "all" | "sms" | "alimtalk";
type SortOrder = "newest" | "oldest";

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

function channelLabel(channel: SendMode): string {
  return channel === "alimtalk" ? "알림톡" : "문자";
}

function senderChannel(channel: SendMode): string {
  if (channel === "alimtalk") return "카카오 채널";
  return "SMS";
}

function recipientSummary(log: MessageLog): string {
  const ctx = log.context !== "manual" ? `${log.context} / ` : "";
  return `${ctx}${log.recipientCount}명`;
}

function truncateBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 35 ? `${normalized.slice(0, 35)}…` : normalized;
}

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1] whitespace-nowrap";

export function HistoryTab() {
  const { data: logs = [], isLoading, isFetching, error, refetch } =
    useMessageLogs();
  const isRefreshing = isFetching && !isLoading;
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selected, setSelected] = useState<MessageLog | null>(null);

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => {
      if (channelFilter === "all") return true;
      if (channelFilter === "alimtalk") return log.channel === "alimtalk";
      return log.channel !== "alimtalk";
    });
    if (sortOrder === "oldest") result = [...result].reverse();
    return result;
  }, [logs, channelFilter, sortOrder]);

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
            ariaLabel="채널 필터"
            options={[
              { value: "all", label: "전체" },
              { value: "sms", label: "문자(SMS)" },
              { value: "alimtalk", label: "알림톡" },
            ]}
            value={channelFilter}
            onChange={(value) => setChannelFilter(value)}
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
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-[#e8ebee] bg-[#fbfcfd]">
            <th className={`${TH} w-[125px]`}>채널</th>
            <th className={`${TH} w-[200px]`}>발신자</th>
            <th className={`${TH} w-[220px]`}>수신자</th>
            <th className={TH}>내용</th>
            <th className={`${TH} w-[100px]`}>결과</th>
            <th className={`${TH} w-[160px]`}>발송 일시</th>
            <th className="w-[96px]" />
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((log) => (
            <tr
              key={log.id}
              onClick={() => setSelected(log)}
              className="cursor-pointer border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fbfcfd]"
            >
              <td className="h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {channelLabel(log.channel)}
              </td>
              <td className="h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {senderChannel(log.channel)}
              </td>
              <td className="h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {recipientSummary(log)}
              </td>
              <td className="h-[49px] max-w-[260px] px-[16px] py-[12px]">
                <span
                  className="block truncate text-[13px] font-medium text-[#191f28]"
                  title={log.body}
                >
                  {truncateBody(log.body)}
                </span>
              </td>
              <td className="h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {log.result}
              </td>
              <td className="h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {formatSentAt(log.sentAt)}
              </td>
              <td className="h-[49px] px-[16px] py-[12px]">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(log);
                  }}
                  className="text-[12.5px] font-bold text-[#14a497]"
                >
                  상세 보기
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <MessageDetailModal
          title="발송 상세"
          channel={selected.channel}
          rows={[
            { label: "수신자", value: recipientSummary(selected) },
            { label: "발송시점", value: formatSentAt(selected.sentAt) },
            { label: "유형", value: "즉시" },
            { label: "상태", value: selected.result },
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
