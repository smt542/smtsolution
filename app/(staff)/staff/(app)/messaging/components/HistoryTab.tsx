"use client";

import { useMemo, useState } from "react";
import { Panel, Select } from "@/components/common";
import { useMessageLogs } from "@/hooks/reactquery/messaging";
import type { SendMode } from "@/lib/messaging/preset";
import { MessageLogList } from "./MessageLogList";

type ChannelFilter = "all" | SendMode;

export function HistoryTab() {
  const { data: logs = [], isLoading, error, refetch } = useMessageLogs();
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [context, setContext] = useState("all");

  const contexts = useMemo(
    () => Array.from(new Set(logs.map((log) => log.context))).sort(),
    [logs],
  );
  const filteredLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          (channel === "all" || log.channel === channel) &&
          (context === "all" || log.context === context),
      ),
    [channel, context, logs],
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel title="이력 필터">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              채널
            </span>
            <Select
              aria-label="채널"
              value={channel}
              onChange={(event) =>
                setChannel(event.target.value as ChannelFilter)
              }
              options={[
                { value: "all", label: "전체" },
                { value: "sms", label: "SMS" },
                { value: "alimtalk", label: "알림톡" },
                { value: "auto", label: "자동" },
              ]}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              발송 구분
            </span>
            <Select
              aria-label="발송 구분"
              value={context}
              onChange={(event) => setContext(event.target.value)}
              options={[
                { value: "all", label: "전체" },
                ...contexts.map((value) => ({ value, label: value })),
              ]}
            />
          </label>
        </div>
      </Panel>

      <MessageLogList
        logs={filteredLogs}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
      />
    </div>
  );
}
