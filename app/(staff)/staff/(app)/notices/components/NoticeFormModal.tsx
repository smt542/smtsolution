"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal, Select, Textarea } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useCreateNotice,
  useUpdateNotice,
  type Notice,
  type NoticeInput,
  type NoticeType,
} from "@/hooks/reactquery/notices";
import {
  getPublishMode,
  toDateTimeLocal,
  toIsoDateTime,
  validateNoticeForm,
  type PublishMode,
} from "../utils";

interface NoticeFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: Notice | null;
  buildings: Building[];
  orgId: number;
  onSaved: (notice: Notice) => void;
}

export function NoticeFormModal(props: NoticeFormModalProps) {
  if (!props.open) return null;
  return <NoticeFormContent key={props.editing?.id ?? "new"} {...props} />;
}

function NoticeFormContent({
  open,
  onClose,
  editing,
  buildings,
  orgId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Notice | null;
  buildings: Building[];
  orgId: number;
  onSaved: (notice: Notice) => void;
}) {
  const mode = editing ? getPublishMode(editing) : "now";
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const [target, setTarget] = useState(editing?.buildingId == null ? "organization" : String(editing.buildingId));
  const [noticeType, setNoticeType] = useState<NoticeType>(editing?.noticeType ?? "normal");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [publishMode, setPublishMode] = useState<PublishMode>(mode);
  const [initialPublishMode] = useState<PublishMode>(mode);
  const [scheduledAt, setScheduledAt] = useState(mode === "scheduled" ? toDateTimeLocal(editing?.publishedAt) : "");
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(editing?.expiresAt));
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateNoticeForm({ title, content, publishMode, scheduledAt, expiresAt });
    if (error) {
      setFormError(error);
      return;
    }

    const now = new Date().toISOString();
    const publishedAt = publishMode === "draft"
      ? null
      : publishMode === "scheduled"
        ? toIsoDateTime(scheduledAt)
        : editing && initialPublishMode === "now" && editing.publishedAt
          ? editing.publishedAt
          : now;

    const payload: NoticeInput = {
      orgId,
      buildingId: target === "organization" ? null : Number(target),
      noticeType,
      title: title.trim(),
      content: content.trim(),
      publishedAt,
      expiresAt: publishMode === "draft" ? null : toIsoDateTime(expiresAt),
    };

    try {
      const saved = editing
        ? await updateNotice.mutateAsync({ id: editing.id, input: payload })
        : await createNotice.mutateAsync(payload);
      toast.success(editing ? "공지가 수정되었습니다." : "공지가 등록되었습니다.");
      onSaved(saved);
      onClose();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "공지를 저장하지 못했습니다.");
    }
  };

  const isPending = createNotice.isPending || updateNotice.isPending;
  const targetOptions = [
    { value: "organization", label: "전체 공지" },
    ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? "공지 수정" : "공지 등록"}>
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <div>
          <label htmlFor="notice-target" className="mb-1 block text-xs font-semibold text-t2">공지 대상 *</label>
          <Select id="notice-target" value={target} onChange={(event) => setTarget(event.target.value)} options={targetOptions} />
          <p className="mt-1 text-xs text-t4">전체 또는 건물 한 곳을 선택할 수 있습니다.</p>
        </div>

        <div>
          <label htmlFor="notice-type" className="mb-1 block text-xs font-semibold text-t2">공지 유형 *</label>
          <Select
            id="notice-type"
            value={noticeType}
            onChange={(event) => setNoticeType(event.target.value as NoticeType)}
            options={[
              { value: "normal", label: "일반" },
              { value: "important", label: "중요" },
              { value: "urgent", label: "긴급" },
            ]}
          />
        </div>

        <div>
          <label htmlFor="notice-title" className="mb-1 block text-xs font-semibold text-t2">제목 *</label>
          <Input id="notice-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="공지 제목" />
        </div>

        <div>
          <label htmlFor="notice-content" className="mb-1 block text-xs font-semibold text-t2">내용 *</label>
          <Textarea
            id="notice-content"
            value={content}
            rows={7}
            onChange={(event) => setContent(event.target.value)}
            placeholder="입주자에게 안내할 내용을 입력해 주세요."
            className="resize-y leading-6"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-t2">게시 방식 *</legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["now", "즉시 게시"],
              ["scheduled", "예약 게시"],
              ["draft", "초안 저장"],
            ] as const).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold ${publishMode === value ? "border-brand bg-blue-t text-blue-d" : "border-line text-t2"}`}>
                <input type="radio" name="publishMode" value={value} checked={publishMode === value} onChange={() => setPublishMode(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {publishMode === "scheduled" && (
          <div>
            <label htmlFor="notice-scheduled-at" className="mb-1 block text-xs font-semibold text-t2">예약 게시 일시 *</label>
            <Input id="notice-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </div>
        )}

        {publishMode !== "draft" && (
          <div>
            <label htmlFor="notice-expires-at" className="mb-1 block text-xs font-semibold text-t2">게시 종료 일시</label>
            <Input id="notice-expires-at" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            <p className="mt-1 text-xs text-t4">비워 두면 종료 없이 계속 게시됩니다.</p>
          </div>
        )}

        {formError && <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">{formError}</p>}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중…" : editing ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
