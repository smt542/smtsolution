"use client";

import { useEffect, useId, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useMe } from "@/hooks/reactquery/auth";
import {
  type MessageTemplate,
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
} from "@/hooks/reactquery/messageTemplates";
import { SelectMenu } from "./SelectMenu";

export interface TemplateFormModalProps {
  open: boolean;
  template?: MessageTemplate;
  onClose: () => void;
  onSaved: () => void;
}

type ChannelType = "sms" | "alimtalk";
type CategoryType = "정기" | "공지";

const CHANNEL_OPTIONS: { value: ChannelType; label: string }[] = [
  { value: "sms", label: "문자" },
  { value: "alimtalk", label: "알림톡" },
];

const CATEGORY_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "정기", label: "정기" },
  { value: "공지", label: "공지" },
];

// 템플릿 내용에 삽입할 수 있는 변수(Figma 28-21455).
const CONTENT_VARIABLES = [
  "건물명",
  "공지제목",
  "호실",
  "입주자명",
  "관리비기간",
  "납기일",
  "출금예정일",
  "고객번호",
  "당월관리비",
  "미납관리비",
  "총납부금액",
  "관리실연락처",
];
// 링크 URL에 삽입할 수 있는 변수.
const URL_VARIABLES = ["링크토큰", "공지ID"];

// 정본 messaging.dc.html #tplScrim(.tf-*) 규격. 줄높이는 모달 루트의 leading-[normal]을 따른다.
const LABEL = "text-[12.5px] font-bold text-t3";
const FIELD =
  "h-[42px] rounded-[11px] border border-line bg-white px-[12px] text-[14px] font-medium text-t1 outline-none placeholder:text-[#757575] focus:border-blue focus:shadow-[0_0_0_3px_var(--color-blue-t)]";
const VAR_CHIP =
  "whitespace-nowrap rounded-[8px] border border-transparent bg-[color-mix(in_srgb,var(--color-blue)_10%,#fff)] px-[10px] py-[4px] text-[12px] font-bold text-blue hover:border-blue-t";
const FOOTER_BUTTON =
  "flex h-[40px] flex-1 items-center justify-center gap-[7px] rounded-[11px] px-[18px] text-[13.5px] font-bold tracking-[-0.01em]";

export function TemplateFormModal({
  open,
  template,
  onClose,
  onSaved,
}: TemplateFormModalProps) {
  if (!open) return null;
  return (
    <TemplateForm
      key={template?.id ?? "new"}
      template={template}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function TemplateForm({
  template,
  onClose,
  onSaved,
}: Omit<TemplateFormModalProps, "open">) {
  const titleId = useId();
  const { data: me } = useMe();
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [channelType, setChannelType] = useState<ChannelType>(
    template?.channelType === "alimtalk" ? "alimtalk" : "sms",
  );
  const [category, setCategory] = useState<CategoryType>(
    template?.category === "공지" ? "공지" : "정기",
  );
  const [alimtalkTemplateCode, setAlimtalkTemplateCode] = useState(
    template?.alimtalkTemplateCode ?? "",
  );
  const [buttonName, setButtonName] = useState(template?.buttons?.[0]?.name ?? "");
  const [buttonUrl, setButtonUrl] = useState(template?.buttons?.[0]?.url ?? "");

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const insertContentVariable = (name: string) => {
    const token = `#{${name}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const save = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      toast.info("제목과 본문을 입력해 주세요.");
      return;
    }
    const buttons = buttonName.trim()
      ? [
          {
            name: buttonName.trim(),
            type: "WL",
            ...(buttonUrl.trim() ? { url: buttonUrl.trim() } : {}),
          },
        ]
      : [];
    const extra = {
      category: channelType === "alimtalk" ? category : null,
      channelType,
      alimtalkTemplateCode:
        channelType === "alimtalk" ? alimtalkTemplateCode.trim() || null : null,
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
      toast.error(error, "저장 실패");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim py-4"
      onClick={onClose}
    >
      {/* 정본처럼 모달은 스크롤하지 않는다. 화면이 낮으면 본문(overflow hidden) 안에서
          템플릿 내용 칸만 줄어든다(180px → 최소 96px). */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100%-32px)] w-[min(620px,94%)] flex-col rounded-[20px] bg-white p-[24px] leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)]"
      >
        <p
          id={titleId}
          className="shrink-0 text-center text-[17px] font-extrabold text-t1"
        >
          {template ? "템플릿 수정" : "템플릿 등록"}
        </p>

        <div className="mt-[20px] flex min-h-0 flex-[1_1_auto] flex-col gap-[20px] overflow-hidden">
          {/* 템플릿 유형 */}
          <div className="flex shrink-0 flex-col gap-[9px]">
            <span className={LABEL}>템플릿 유형</span>
            <div className="flex gap-[8px]">
              <SelectMenu
                ariaLabel="채널 유형"
                className="flex-1"
                value={channelType}
                options={CHANNEL_OPTIONS}
                onChange={(value) => setChannelType(value)}
              />
              {channelType === "alimtalk" && (
                <SelectMenu
                  ariaLabel="발송 구분"
                  className="flex-1"
                  value={category}
                  options={CATEGORY_OPTIONS}
                  onChange={(value) => setCategory(value)}
                />
              )}
            </div>
          </div>

          {/* 템플릿명 */}
          <div className="flex shrink-0 flex-col gap-[9px]">
            <span className={LABEL}>템플릿명</span>
            <input
              aria-label="템플릿명"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예) 관리비 고지 안내"
              className={`${FIELD} w-full`}
            />
          </div>

          {/* 템플릿 내용 — 남는 높이를 이 칸이 가져가고, 모자라면 이 칸만 줄어든다. */}
          <div className="flex min-h-0 flex-[1_1_auto] flex-col gap-[9px]">
            <span className={`${LABEL} shrink-0`}>템플릿 내용</span>
            <textarea
              ref={bodyRef}
              aria-label="템플릿 내용"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="메시지 내용을 입력해 주세요"
              className="min-h-[96px] w-full flex-[1_1_180px] resize-none rounded-[11px] border border-line bg-white px-[13px] py-[12px] text-[13.5px] font-medium leading-[1.7] text-t1 outline-none placeholder:text-[#757575] focus:border-blue focus:shadow-[0_0_0_3px_var(--color-blue-t)]"
            />
            <div className="mt-[2px] flex shrink-0 flex-wrap gap-[6px]">
              {CONTENT_VARIABLES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => insertContentVariable(name)}
                  className={VAR_CHIP}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 알림톡 전용: 템플릿코드 + 링크 버튼 */}
          {channelType === "alimtalk" && (
            <>
              <div className="flex shrink-0 flex-col gap-[9px]">
                <span className={LABEL}>알림톡 템플릿코드</span>
                <input
                  aria-label="알림톡 템플릿코드"
                  value={alimtalkTemplateCode}
                  onChange={(event) => setAlimtalkTemplateCode(event.target.value)}
                  placeholder="카카오 승인 템플릿 코드"
                  className={`${FIELD} w-full`}
                />
              </div>

              <div className="flex shrink-0 flex-col gap-[9px]">
                <span className={LABEL}>
                  링크 <span className="font-medium text-t4">알림톡 버튼</span>
                </span>
                <div className="flex gap-[8px]">
                  <input
                    aria-label="버튼명"
                    value={buttonName}
                    onChange={(event) => setButtonName(event.target.value)}
                    placeholder="버튼명 (예: 자세히 보기)"
                    className={`${FIELD} w-[160px] shrink-0`}
                  />
                  <input
                    aria-label="연결 URL"
                    value={buttonUrl}
                    onChange={(event) => setButtonUrl(event.target.value)}
                    placeholder="연결 URL (https://)"
                    className={`${FIELD} min-w-0 flex-1`}
                  />
                </div>
                <div className="mt-[8px] flex flex-wrap items-center gap-[6px] text-[12px] font-medium text-t3">
                  <span>URL에도 변수를 쓸 수 있어요</span>
                  {URL_VARIABLES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setButtonUrl((prev) => `${prev}#{${name}}`)}
                      className={VAR_CHIP}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="mt-[20px] flex shrink-0 justify-end gap-[8px]">
          <button
            type="button"
            onClick={onClose}
            className={`${FOOTER_BUTTON} bg-bg text-t2 hover:bg-line2`}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isPending}
            className={`${FOOTER_BUTTON} bg-blue text-white transition hover:bg-blue-d disabled:opacity-60`}
          >
            {isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
