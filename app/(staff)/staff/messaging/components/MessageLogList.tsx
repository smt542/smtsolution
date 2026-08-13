import { DataTable, EmptyState, Panel, Spinner } from "@/components/common";
import type { MessageLog } from "@/hooks/reactquery/messaging";

export interface MessageLogListProps {
  logs: MessageLog[];
  isLoading?: boolean;
}

function formatSentAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function summarizeBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 60
    ? `${normalized.slice(0, 60)}…`
    : normalized;
}

export function MessageLogList({
  logs,
  isLoading = false,
}: MessageLogListProps) {
  if (isLoading) {
    return (
      <Panel title="발송 이력">
        <div aria-label="발송 이력 불러오는 중" className="py-8">
          <Spinner />
          <p className="text-center text-sm text-t4">
            발송 이력을 불러오는 중입니다.
          </p>
        </div>
      </Panel>
    );
  }

  if (logs.length === 0) {
    return (
      <Panel title="발송 이력">
        <EmptyState message="발송 이력이 없습니다." />
      </Panel>
    );
  }

  const columns = [
    { key: "sender", label: "발송자" },
    { key: "sentAt", label: "발송 일시" },
    { key: "recipientCount", label: "수신처 수" },
    { key: "channel", label: "채널" },
    { key: "body", label: "본문 요약" },
    { key: "result", label: "결과" },
  ];
  const rows = logs.map((log) => ({
    sender: log.sentBy ?? "-",
    sentAt: formatSentAt(log.sentAt),
    recipientCount: `${log.recipientCount}명`,
    channel: log.channel.toUpperCase(),
    body: <span title={log.body}>{summarizeBody(log.body)}</span>,
    result: (
      <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
        {log.result}
      </span>
    ),
  }));

  return (
    <Panel title="발송 이력">
      <DataTable columns={columns} rows={rows} />
    </Panel>
  );
}
