"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useScheduledMessages,
  useCancelScheduledMessage,
  type ScheduledMessage,
} from "@/hooks/reactquery/messaging";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { MessageDetailModal } from "./MessageDetailModal";
import { MessagingListCard } from "./MessagingListCard";
import {
  buildRecipientSummary,
  channelLabel,
  formatMessageDateTime,
  senderLabel,
  truncateBody,
} from "./messageFormat";
import { SegmentedFilter } from "./SegmentedFilter";

type RecurrenceFilter = "all" | "monthly" | "once";
type SortOrder = "newest" | "oldest";

function scheduleType(msg: ScheduledMessage): string {
  return msg.recurrenceMode === "monthly" ? "예약(매월)" : "예약";
}

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-[#8b95a1] whitespace-nowrap";
const TD =
  "h-[47.8px] px-[16px] py-[12px] text-[13px] font-medium leading-[normal] text-[#191f28]";

function CancelButton({ id }: { id: number }) {
  const { mutate, isPending } = useCancelScheduledMessage();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={(event) => {
        event.stopPropagation();
        mutate(id);
      }}
      className="whitespace-nowrap text-[12.5px] font-bold text-[#f04452] disabled:opacity-50"
    >
      {isPending ? "취소 중…" : "예약 취소"}
    </button>
  );
}

export function ScheduledTab() {
  const { data: messages = [], isLoading, isFetching, error, refetch } =
    useScheduledMessages();
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);
  const { data: buildings = [] } = useBuildings();
  const isRefreshing = isFetching && !isLoading;
  const [filter, setFilter] = useState<RecurrenceFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selected, setSelected] = useState<ScheduledMessage | null>(null);

  const buildingNameById = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.name] as const)),
    [buildings],
  );

  const filtered = useMemo(() => {
    let result = messages.filter((m) => {
      if (filter === "monthly") return m.recurrenceMode === "monthly";
      if (filter === "once") return m.recurrenceMode === null;
      return true;
    });
    if (sortOrder === "oldest") result = [...result].reverse();
    return result;
  }, [messages, filter, sortOrder]);

  const openScheduledMessage = (message: ScheduledMessage) => setSelected(message);
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    message: ScheduledMessage,
  ) => {
    if (event.target instanceof HTMLButtonElement) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openScheduledMessage(message);
    }
  };

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
          {filtered.map((msg) => {
            const scheduledAt = formatMessageDateTime(msg.scheduledAt);
            const rowLabel = `${channelLabel(msg.channel)} ${scheduledAt} 예약 발송 상세 보기`;

            return (
              <tr
                key={msg.id}
                tabIndex={0}
                aria-label={rowLabel}
                onClick={() => openScheduledMessage(msg)}
                onKeyDown={(event) => handleRowKeyDown(event, msg)}
                className="cursor-pointer border-b border-[#f1f3f5] last:border-b-0 hover:bg-[#fbfcfd]"
              >
                <td className={TD}>{channelLabel(msg.channel)}</td>
                <td className={TD}>{senderLabel(msg.channel, config?.smsSender)}</td>
                <td className={TD}>
                  {buildRecipientSummary(msg.recipients, msg.recipientCount, buildingNameById)}
                </td>
                <td className={`${TD} max-w-[260px]`}>
                  <span className="block truncate" title={msg.body}>
                    {truncateBody(msg.body)}
                  </span>
                </td>
                <td className={TD}>{scheduleType(msg)}</td>
                <td className={TD}>{scheduledAt}</td>
                <td className={TD}>
                  <CancelButton id={msg.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <MessageDetailModal
          recipientsAlreadyMasked={false}
          title="예약 발송 상세"
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
            { label: "발송시점", value: formatMessageDateTime(selected.scheduledAt) },
            { label: "유형", value: scheduleType(selected) },
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
