"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  type MessageTemplate,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
} from "@/hooks/reactquery/messageTemplates";
import { extractVariables } from "@/lib/messaging/render";

export interface TemplateFormModalProps {
  open: boolean;
  template?: MessageTemplate;
  onClose: () => void;
  onSaved: () => void;
}

export function TemplateFormModal({
  open,
  template,
  onClose,
  onSaved,
}: TemplateFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? "템플릿 수정" : "새 템플릿"}
    >
      <TemplateFormFields
        key={template?.id ?? "new"}
        template={template}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Modal>
  );
}

function TemplateFormFields({
  template,
  onClose,
  onSaved,
}: Omit<TemplateFormModalProps, "open">) {
  const { data: me } = useMe();
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [channelType, setChannelType] = useState(template?.channelType ?? "sms");
  const [category, setCategory] = useState(template?.category ?? "");
  const [alimtalkTemplateCode, setAlimtalkTemplateCode] = useState(template?.alimtalkTemplateCode ?? "");
  const [buttonName, setButtonName] = useState(template?.buttons?.[0]?.name ?? "");
  const [buttonUrl, setButtonUrl] = useState(template?.buttons?.[0]?.url ?? "");

  const variables = useMemo(() => extractVariables(body), [body]);
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const save = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      toast.info("제목과 본문을 입력해 주세요.");
      return;
    }

    const buttons = buttonName.trim()
      ? [{ name: buttonName.trim(), type: "WL", ...(buttonUrl.trim() ? { url: buttonUrl.trim() } : {}) }]
      : [];
    const extra = {
      category: category.trim() || null,
      channelType,
      alimtalkTemplateCode: channelType === "alimtalk" ? alimtalkTemplateCode.trim() || null : null,
      buttons,
    };

    try {
      if (template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          input: { title: trimmedTitle, body: trimmedBody, ...extra },
        });
      } else {
        if (!me?.orgId) {
          toast.error("조직 정보를 확인할 수 없습니다.");
          return;
        }
        await createTemplate.mutateAsync({
          orgId: me.orgId,
          title: trimmedTitle,
          body: trimmedBody,
          ...extra,
        });
      }

      toast.success("저장했습니다.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 실패");
    }
  };

  return (
    <div className="flex flex-col gap-4">
        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">제목</span>
          <input
            aria-label="템플릿 제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="템플릿 제목을 입력해 주세요."
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-bold text-t2">본문</span>
          <textarea
            aria-label="템플릿 본문"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="알림톡 본문을 입력해 주세요."
            className="min-h-40 w-full rounded-xl border border-line bg-surface p-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-bold text-t2">채널 유형</span>
            <select
              aria-label="채널 유형"
              value={channelType}
              onChange={(event) => setChannelType(event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none"
            >
              <option value="sms">문자(SMS)</option>
              <option value="alimtalk">알림톡</option>
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-bold text-t2">구분</span>
            <input
              aria-label="템플릿 구분"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="예: 독촉 · 고지 · 공지"
              className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        {channelType === "alimtalk" && (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg p-3">
            <label>
              <span className="mb-1.5 block text-xs font-bold text-t2">알림톡 템플릿코드</span>
              <input
                aria-label="알림톡 템플릿코드"
                value={alimtalkTemplateCode}
                onChange={(event) => setAlimtalkTemplateCode(event.target.value)}
                placeholder="카카오 승인 템플릿 코드"
                className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-bold text-t2">버튼 이름</span>
                <input
                  aria-label="버튼 이름"
                  value={buttonName}
                  onChange={(event) => setButtonName(event.target.value)}
                  placeholder="예: 확인하기"
                  className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-bold text-t2">버튼 링크</span>
                <input
                  aria-label="버튼 링크"
                  value={buttonUrl}
                  onChange={(event) => setButtonUrl(event.target.value)}
                  placeholder="https://"
                  className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
                />
              </label>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-bg p-3 text-xs text-t3">
          <p>사용 가능한 변수: #{"{이름}"} · #{"{호실}"} · #{"{건물명}"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-bold text-t2">사용 변수</span>
            {variables.length === 0 ? (
              <span>없음</span>
            ) : (
              variables.map((variable) => (
                <span
                  key={variable}
                  className="rounded-lg bg-brand/10 px-2 py-1 font-bold text-brand"
                >
                  {variable}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={isPending}
          >
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
    </div>
  );
}
