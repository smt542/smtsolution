import { Button, DataTable, EmptyState, Panel, Spinner } from "@/components/common";
import type { MessageLog } from "@/hooks/reactquery/messaging";
import { formatNumber } from "@/lib/format";

export interface MessageLogListProps {
  logs: MessageLog[];
  isLoading?: boolean;
  error?: unknown;
  onRetry: () => void;
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
    timeZone: "Asia/Seoul",
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
  error,
  onRetry,
}: MessageLogListProps) {
  if (isLoading) {
    return (
      <Panel title="발송 이력">
        <div className="min-h-[180px] py-8">
          <Spinner label="발송 이력 불러오는 중" showLabel />
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="발송 이력">
        <div role="alert" className="py-8 text-center">
          <p className="font-bold text-t1">발송 이력을 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-t3">잠시 후 다시 시도해 주세요.</p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4"
            onClick={onRetry}
          >
            다시 시도
          </Button>
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
    { key: "sender", label: "발송자 ID" },
    { key: "sentAt", label: "발송 일시" },
    { key: "recipientCount", label: "수신처 수" },
    { key: "channel", label: "채널" },
    { key: "body", label: "본문 요약" },
    { key: "points", label: "포인트" },
    { key: "result", label: "결과" },
  ];
  const rows = logs.map((log) => ({
    sender: log.sentBy ?? "-",
    sentAt: formatSentAt(log.sentAt),
    recipientCount: `${log.recipientCount}명`,
    channel: log.channel.toUpperCase(),
    body: <span title={log.body}>{summarizeBody(log.body)}</span>,
    points: <PointStatus log={log} />,
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

function PointStatus({ log }: { log: MessageLog }) {
  if (log.pointStatus === "settled") {
    return <span className="font-bold text-t1">차감 {formatNumber(log.chargedPoints)} P</span>;
  }
  if (log.pointStatus === "reserved") {
    return <span className="font-bold text-amber">예약 {formatNumber(log.estimatedPoints)} P</span>;
  }
  if (log.pointStatus === "reconcile_required") {
    return <span className="font-bold text-danger">확인 필요</span>;
  }
  if (log.pointStatus === "released") {
    return <span className="text-t3">예약 해제 · 0 P</span>;
  }
  if (log.pointStatus === "quoted") {
    return <span className="text-t3">예상 {formatNumber(log.estimatedPoints)} P · 차감 없음</span>;
  }
  return <span className="text-t4">-</span>;
}
