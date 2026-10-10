"use client";

import { Button, Modal } from "@/components/common";
import {
  AUDIT_LOG_CATEGORY_LABELS,
  auditLogActionLabel,
  type PlatformAuditLog,
} from "@/hooks/reactquery/platform";
import { formatDateTime } from "@/lib/format";

function formatJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-[7px]">
      <dt className="w-[72px] shrink-0 text-[12.5px] font-bold text-t3">{label}</dt>
      <dd className="min-w-0 flex-1 break-all text-[13.5px] font-semibold text-t1">{value}</dd>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  const text = formatJson(value);
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-[6px] text-[12.5px] font-bold text-t3">{label}</div>
      {text ? (
        <pre className="num max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded-[10px] bg-bg px-3 py-[10px] text-[12px] font-medium leading-[1.5] text-t2">
          {text}
        </pre>
      ) : (
        <div className="rounded-[10px] bg-bg px-3 py-[10px] text-[12.5px] font-medium text-t4">기록 없음</div>
      )}
    </div>
  );
}

/** 감사 로그 1건 상세 — 조회 전용(감사 로그는 수정·삭제하지 않는다). */
export function AuditLogDetailModal({
  log,
  onClose,
}: {
  log: PlatformAuditLog;
  onClose: () => void;
}) {
  const actor = log.actorName
    ? `${log.actorName}${log.actorUsername ? ` (${log.actorUsername})` : ""}`
    : log.actorUsername ?? "시스템";
  const target = log.tableName
    ? `${log.tableName}${log.rowPk ? ` #${log.rowPk}` : ""}`
    : "-";

  return (
    <Modal
      open
      onClose={onClose}
      title="감사 로그 상세"
      className="flex max-h-[88vh] max-w-[min(640px,92vw)] flex-col rounded-[20px] px-0 pb-0 pt-[22px] leading-[normal] shadow-hf-modal [&>h2]:px-6 [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <p className="mt-[6px] px-6 pb-1 text-[13px] font-medium leading-[normal] text-t3">
        감사 로그는 조회만 가능하며 수정·삭제할 수 없습니다.
      </p>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-4 pt-[14px]">
        <dl className="divide-y divide-line2 border-y border-line2">
          <InfoRow label="일시" value={formatDateTime(log.createdAt)} />
          <InfoRow
            label="작업"
            value={`${auditLogActionLabel(log.action)} · ${AUDIT_LOG_CATEGORY_LABELS[log.category] ?? log.category}`}
          />
          <InfoRow label="코드" value={log.action} />
          <InfoRow label="테넌트" value={log.orgName ?? "-"} />
          <InfoRow label="작업자" value={actor} />
          <InfoRow label="대상" value={target} />
          <InfoRow label="IP" value={log.ip ?? "-"} />
        </dl>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <JsonBlock label="변경 전" value={log.before} />
          <JsonBlock label="변경 후" value={log.after} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line2 px-6 pb-5 pt-4">
        <div className="flex-1" />
        <Button type="button" size="std" variant="primary" className="border border-transparent" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}
