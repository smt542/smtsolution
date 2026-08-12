import { Button, Modal } from "@/components/common";
import type { OverdueMessageDraft } from "@/hooks/reactquery/overdue";

export function MessagingPreviewModal({
  draft,
  onClose,
}: {
  draft: OverdueMessageDraft | null;
  onClose: () => void;
}) {
  if (!draft) return null;

  return (
    <Modal open title="문자 발송 준비 중" onClose={onClose}>
      <div className="rounded-xl bg-blue-t2 p-4">
        <p className="text-sm font-bold text-t1">
          공용 문자 발송 모듈을 연결하고 있습니다.
        </p>
        <p className="mt-1 text-xs leading-5 text-t2">
          수신 대상과 독촉 템플릿만 준비했으며 실제 문자는 발송되지 않았습니다.
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-t1">수신 대상</h3>
          <span className="rounded-full bg-blue-t px-2.5 py-1 text-xs font-bold text-blue-d">
            {draft.recipients.length}세대
          </span>
        </div>
        <ul className="mt-2 max-h-44 divide-y divide-line2 overflow-y-auto rounded-xl border border-line px-3">
          {draft.recipients.map((recipient) => (
            <li key={recipient.occupancyId} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-bold text-t1">
                {recipient.unitNo} · {recipient.tenantName || "입주자 미등록"}
              </span>
              <span className="num text-xs text-t3">{recipient.phone || "연락처 없음"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onClose}>확인</Button>
      </div>
    </Modal>
  );
}

