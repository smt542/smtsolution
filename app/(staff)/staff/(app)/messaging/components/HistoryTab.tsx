"use client";

import { useMemo, useState } from "react";
import { Button, Spinner } from "@/components/common";
import { useMessageLogs, type MessageLog } from "@/hooks/reactquery/messaging";
import type { SendMode } from "@/lib/messaging/preset";

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
      SMS
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

const TH_BASE = "px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1] whitespace-nowrap";

export function HistoryTab() {
  const { data: logs = [], isLoading, error, refetch } = useMessageLogs();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const filteredLogs = useMemo(() => {
    let result = logs.filter((log) => {
      if (channelFilter === "all") return true;
      if (channelFilter === "alimtalk") return log.channel === "alimtalk";
      return log.channel !== "alimtalk";
    });
    if (sortOrder === "oldest") result = [...result].reverse();
    return result;
  }, [logs, channelFilter, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-[12px] rounded-[16px] bg-white py-[60px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
        <Spinner />
        <p className="text-[14px] text-[#8b95a1]">발송 내역을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-[12px] rounded-[16px] bg-white py-[60px] shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]"
      >
        <p className="text-[15px] font-bold text-[#191f28]">발송 내역을 불러오지 못했습니다.</p>
        <Button type="button" variant="ghost" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
        <span className="text-[15px] font-extrabold text-[#191f28]">발송 내역</span>
        <span className="pl-[2px] text-[13px] font-semibold text-[#8b95a1]">
          {filteredLogs.length}
        </span>
        <div className="flex-1" />
        <PillFilter
          options={[
            { value: "all", label: "전체" },
            { value: "sms", label: "문자(SMS)" },
            { value: "alimtalk", label: "알림톡" },
          ]}
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as ChannelFilter)}
        />
        <PillFilter
          options={[
            { value: "newest", label: "최신순" },
            { value: "oldest", label: "오래된순" },
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
              <th className={`${TH_BASE} w-[125px]`}>채널</th>
              <th className={`${TH_BASE} w-[200px]`}>수신처</th>
              <th className={`${TH_BASE} w-[220px]`}>수신자</th>
              <th className={TH_BASE}>내용</th>
              <th className={`${TH_BASE} w-[100px]`}>상태</th>
              <th className={`${TH_BASE} w-[160px]`}>발송 일시</th>
              <th className="w-[96px]" />
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-[60px] text-center text-[14px] text-[#8b95a1]"
                >
                  발송 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fafbfc]"
                >
                  <td className="h-[48px] px-[16px] py-[12px]">
                    <ChannelBadge channel={log.channel} />
                  </td>
                  <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {senderChannel(log.channel)}
                  </td>
                  <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {recipientSummary(log)}
                  </td>
                  <td className="h-[48px] max-w-[260px] px-[16px] py-[12px]">
                    <span
                      className="block truncate text-[13px] font-medium text-[#191f28]"
                      title={log.body}
                    >
                      {truncateBody(log.body)}
                    </span>
                  </td>
                  <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {log.result}
                  </td>
                  <td className="h-[48px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {formatSentAt(log.sentAt)}
                  </td>
                  <td className="h-[48px] px-[16px] py-[12px]">
                    <span className="text-[12.5px] font-bold text-[#f04452]">
                      상세 보기
                    </span>
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
