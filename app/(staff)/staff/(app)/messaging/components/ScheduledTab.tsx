"use client";

import { useMemo, useState } from "react";
import {
  useScheduledMessages,
  useCancelScheduledMessage,
  type ScheduledMessage,
} from "@/hooks/reactquery/messaging";
import type { SendMode } from "@/lib/messaging/preset";
import { MessagingListCard } from "./MessagingListCard";
import { SegmentedFilter } from "./SegmentedFilter";

type RecurrenceFilter = "all" | "monthly" | "once";
type SortOrder = "newest" | "oldest";

function formatScheduledAt(value: string): string {
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

function senderLabel(channel: SendMode): string {
  return channel === "alimtalk" ? "관리비서 채널" : "SMS";
}

function recipientSummary(msg: ScheduledMessage): string {
  const ctx = msg.context !== "manual" ? `${msg.context} / ` : "";
  return `${ctx}${msg.recipientCount}명`;
}

function scheduleType(msg: ScheduledMessage): string {
  return msg.recurrenceMode === "monthly" ? "예약(매월)" : "예약";
}

function truncateBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 35 ? `${normalized.slice(0, 35)}…` : normalized;
}

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1] whitespace-nowrap";

function CancelButton({ id }: { id: number }) {
  const { mutate, isPending } = useCancelScheduledMessage();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => mutate(id)}
      className="text-[12.5px] font-bold text-[#f04452] disabled:opacity-50"
    >
      {isPending ? "취소 중…" : "예약 취소"}
    </button>
  );
}

export function ScheduledTab() {
  const { data: messages = [], isLoading, isFetching, error, refetch } =
    useScheduledMessages();
  const isRefreshing = isFetching && !isLoading;
  const [filter, setFilter] = useState<RecurrenceFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const filtered = useMemo(() => {
    let result = messages.filter((m) => {
      if (filter === "monthly") return m.recurrenceMode === "monthly";
      if (filter === "once") return m.recurrenceMode === null;
      return true;
    });
    if (sortOrder === "oldest") result = [...result].reverse();
    return result;
  }, [messages, filter, sortOrder]);

  return (
    <MessagingListCard
      title="예약 발송"
      count={filtered.length}
      refreshing={isRefreshing}
      refreshingLabel="예약 발송 목록 갱신 중"
      isLoading={isLoading}
      loadingLabel="예약 발송 목록 불러오는 중"
      error={error}
      errorMessage="목록을 불러오지 못했습니다."
      onRetry={() => void refetch()}
      isEmpty={filtered.length === 0}
      emptyMessage="예약된 발송이 없습니다."
      actions={
        <>
          <SegmentedFilter
            ariaLabel="예약 유형 필터"
            options={[
              { value: "all", label: "전체" },
              { value: "monthly", label: "예약(매월)" },
              { value: "once", label: "예약" },
            ]}
            value={filter}
            onChange={(value) => setFilter(value)}
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
            <th className={`${TH} w-[232px]`}>발신자</th>
            <th className={`${TH} w-[299px]`}>수신자</th>
            <th className={TH}>내용</th>
            <th className={`${TH} w-[164px]`}>유형</th>
            <th className={`${TH} w-[272px]`}>예약 일시</th>
            <th className="w-[96px]" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((msg) => (
            <tr
              key={msg.id}
              className="border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fbfcfd]"
            >
              <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {channelLabel(msg.channel)}
              </td>
              <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {senderLabel(msg.channel)}
              </td>
              <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {recipientSummary(msg)}
              </td>
              <td className="h-[48px] max-w-[260px] px-[16px] py-[12px]">
                <span
                  className="block truncate text-[13px] font-medium text-[#191f28]"
                  title={msg.body}
                >
                  {truncateBody(msg.body)}
                </span>
              </td>
              <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {scheduleType(msg)}
              </td>
              <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                {formatScheduledAt(msg.scheduledAt)}
              </td>
              <td className="h-[48px] px-[16px] py-[12px]">
                <CancelButton id={msg.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </MessagingListCard>
  );
}
