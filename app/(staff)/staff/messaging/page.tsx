"use client";

import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useMessageLogs } from "@/hooks/reactquery/messaging";
import { hasModule } from "@/lib/auth/permissions";
import { MessageLogList } from "./components/MessageLogList";
import { MessagingComposer } from "./components/MessagingComposer";

export default function MessagingPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading || me === undefined) {
    return (
      <div className="p-6">
        <Spinner />
      </div>
    );
  }

  if (!hasModule(me, "messaging")) {
    return (
      <div className="p-6">
        <EmptyState message="문자 발송 권한이 없습니다." />
      </div>
    );
  }

  return <MessagingWorkspace />;
}

function MessagingWorkspace() {
  const { data: logs = [], isLoading, error, refetch } = useMessageLogs();

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-extrabold text-t1">문자·알림톡 발송</h1>
        <p className="mt-1 text-sm text-t3">
          수신처와 내용을 선택해 문자를 발송하고 발송 이력을 확인합니다.
        </p>
      </header>

      <MessagingComposer />
      <MessageLogList
        logs={logs}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
      />
    </div>
  );
}
