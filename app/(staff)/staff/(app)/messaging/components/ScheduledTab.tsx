"use client";

import { useMemo, useState } from "react";
import { Button, Spinner } from "@/components/common";
import {
  useScheduledMessages,
  useCancelScheduledMessage,
  type ScheduledMessage,
} from "@/hooks/reactquery/messaging";
import type { SendMode } from "@/lib/messaging/preset";

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

function ChannelBadge({ channel }: { channel: SendMode }) {
  if (channel === "alimtalk") {
    return (
      <span className="inline-flex items-center rounded-[6px] bg-[#fff8e1] px-[8px] py-[3px] text-[12px] font-bold text-[#d97706]">
        알림톡
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[6px] bg-[#e8f5e9] px-[8px] py-[3px] text-[12px] font-bold text-[#2e7d32]">
      문자
    </span>
  );
}

function PillFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold transition-colors ${
            value === opt.value
              ? "bg-white text-[#191f28] shadow-[0px_1px_1.5px_rgba(23,31,40,0.1)]"
              : "text-[#8b95a1]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const TH = "px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1] whitespace-nowrap";

function CancelButton({ id }: { id: number }) {
  const { mutate, isPending } = useCancelScheduledMessage();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => mutate(id)}
      className="inline-flex h-[23px] w-[64px] items-center justify-center rounded-[7px] border border-[#f04452] text-[12.5px] font-bold text-[#f04452] hover:bg-[#fff5f5] disabled:opacity-50"
    >
      {isPending ? "예약 취소 중…" : "예약 취소"}
    </button>
  );
}

export function ScheduledTab() {
  const { data: messages = [], isLoading, isFetching, error, refetch } = useScheduledMessages();
  const isScheduledMessagesRefreshing = isFetching && !isLoading;
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

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-[12px] rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
        <Spinner label="예약 발송 목록 불러오는 중" showLabel />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-[12px] rounded-[16px] bg-white py-[60px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]"
      >
        <p className="text-[15px] font-bold text-[#191f28]">목록을 불러오지 못했습니다.</p>
        <Button type="button" variant="ghost" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
      {isScheduledMessagesRefreshing ? (
        <div className="absolute right-4 top-3 z-10 rounded-lg bg-white/95 shadow-card">
          <Spinner label="예약 발송 목록 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
      {/* 카드 헤더 */}
      <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
        <span className="text-[15px] font-extrabold text-[#191f28]">예약 발송</span>
        <span className="pl-[2px] text-[13px] font-semibold text-[#8b95a1]">
          {filtered.length}
        </span>
        <div className="flex-1" />
        <PillFilter
          options={[
            { value: "all", label: "전체" },
            { value: "monthly", label: "예약(매월)" },
            { value: "once", label: "예약" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as RecurrenceFilter)}
        />
        <PillFilter
          options={[
            { value: "newest", label: "최신순" },
            { value: "oldest", label: "과거순" },
          ]}
          value={sortOrder}
          onChange={(v) => setSortOrder(v as SortOrder)}
        />
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-[60px] text-center text-[14px] text-[#8b95a1]">
                  예약된 발송이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((msg) => (
                <tr key={msg.id} className="border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fafbfc]">
                  <td className="h-[48px] px-[16px] py-[12px]">
                    <ChannelBadge channel={msg.channel} />
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
