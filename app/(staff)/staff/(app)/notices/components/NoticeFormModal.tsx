"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useDismissOnEscape } from "@/hooks/common";
import { Input, Textarea } from "@/components/common";
import { setSubmissionError } from "@/components/forms/formErrors";
import { NoticeTargetBuildings } from "./NoticeTargetBuildings";
import { plainTextToNoticeDoc } from "@/lib/notice/richText";
import {
  createNoticeFormSchema,
  type NoticeFormInput,
  type NoticeFormValues,
} from "@/components/forms/schema/notice";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useCreateNotice,
  useUpdateNotice,
  type Notice,
  type NoticeInput,
  type NoticeType,
} from "@/hooks/reactquery/notices";
import {
  NOTICE_TYPE_LABELS,
  toNoticeBuildingIds,
  toNoticeTargetSelection,
  type NoticeTargetSelection,
} from "../utils";

const TYPE_ORDER: NoticeType[] = ["normal", "important", "urgent"];

/** 유형별 안내 문구(Figma 41:26586). 신규 문구는 시안 그대로, 중요·긴급은 동일 톤으로 작성. */
const TYPE_HINT: Record<NoticeType, string> = {
  normal: "일반 안내 공지예요. 앱 공지 목록에 표시됩니다.",
  important: "중요 공지예요. 목록 상단에 강조되어 표시됩니다.",
  urgent: "긴급 공지예요. 앱에서 눈에 띄게 강조 표시됩니다.",
};

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
  onClose,
  editing,
  buildings,
  orgId,
  onSaved,
}: NoticeFormModalProps) {
  const titleId = useId();
  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const schema = useMemo(() => createNoticeFormSchema(), []);
  // 대상 건물: 신규는 전체 건물로 시작한다(정본).
  const [targets, setTargets] = useState<NoticeTargetSelection>(() =>
    toNoticeTargetSelection(editing?.buildingIds ?? []),
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NoticeFormInput, unknown, NoticeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      noticeType: editing?.noticeType ?? "normal",
      title: editing?.title ?? "",
      content: editing?.content ?? "",
      // 게시 방식 UI는 제거(Figma). 신규 등록은 즉시 게시로 고정하고 스키마만 충족한다.
      publishMode: "now",
      scheduledAt: "",
      expiresAt: "",
    },
    shouldFocusError: true,
  });

  const isPending = createNotice.isPending || updateNotice.isPending || isSubmitting;
  const closeSafely = () => {
    if (!isPending) onClose();
  };

  useDismissOnEscape({
    enabled: true,
    onDismiss: onClose,
    disabled: isPending,
    lockBodyScroll: true,
  });

  const submit = async (values: NoticeFormValues) => {
    const buildingIds = toNoticeBuildingIds(targets, buildings);
    if (!buildingIds) {
      toast.warning("대상 건물을 선택해 주세요");
      return;
    }
    const now = new Date().toISOString();
    const payload: NoticeInput = {
      orgId,
      buildingIds,
      noticeType: values.noticeType,
      title: values.title,
      content: values.content,
      contentJson: plainTextToNoticeDoc(values.content),
      // 즉시 게시 고정. 수정 시에는 기존 게시/종료 시각을 보존해 예약·초안·종료 설정을 훼손하지 않는다.
      publishedAt: editing ? editing.publishedAt : now,
      expiresAt: editing ? editing.expiresAt : null,
    };

    try {
      const saved = editing
        ? await updateNotice.mutateAsync({ id: editing.id, input: payload })
        : await createNotice.mutateAsync(payload);
      toast.success(editing ? "공지가 수정되었습니다." : "공지가 등록되었습니다.");
      onSaved(saved);
      reset();
      onClose();
    } catch (saveError) {
      toast.error(saveError, "공지를 저장하지 못했습니다.");
      setSubmissionError(saveError, setError, "공지를 저장하지 못했습니다.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onClick={closeSafely}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-[660px] max-w-full flex-col overflow-y-auto rounded-[20px] bg-white p-[24px] drop-shadow-[0px_30px_35px_rgba(0,0,0,0.4)]"
      >
        {/* 헤더: 가운데 정렬 제목 */}
        <div className="flex w-full flex-col items-center">
          <h2 id={titleId} className="text-center text-[17px] font-extrabold leading-[normal] text-[#191f28]">
            {editing ? "공지 수정" : "공지 등록"}
          </h2>
        </div>

        {/* 본문: 시안 20px 리듬(헤더→본문 20 / 항목 간 20 / 본문→푸터 20). 높이는 내용에 맞춰 늘고 카드가 90vh에서 스크롤. */}
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-[20px] pt-[20px]">
          {/* 유형 */}
          <Controller
            control={control}
            name="noticeType"
            render={({ field }) => {
              const active = (field.value ?? "normal") as NoticeType;
              return (
                <div className="flex flex-col gap-[9px]">
                  <span className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">유형</span>
                  <div className="inline-flex gap-[2px] self-start rounded-[9px] bg-[#edf0f3] p-[3px]">
                    {TYPE_ORDER.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active === value}
                        onClick={() => field.onChange(value)}
                        className={
                          active === value
                            ? "rounded-[7px] bg-white px-[11px] py-[5px] text-[12px] font-bold leading-[normal] text-[#191f28] drop-shadow-[0px_1px_1.5px_rgba(23,31,40,0.1)]"
                            : "rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[normal] text-[#8b95a1]"
                        }
                      >
                        {NOTICE_TYPE_LABELS[value]}
                      </button>
                    ))}
                  </div>
                  <p className="pt-[8px] text-[12px] font-semibold leading-[normal] text-[#8b95a1]">
                    {TYPE_HINT[active]}
                  </p>
                </div>
              );
            }}
          />

          {/* 제목 */}
          <div className="flex flex-col gap-[9px]">
            <label htmlFor="notice-title" className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">제목</label>
            <Input
              unstyled
              id="notice-title"
              {...register("title")}
              maxLength={40}
              placeholder="예) 저수조 청소로 오전 단수 예정"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "notice-title-error" : undefined}
              className="h-[42px] w-full rounded-[11px] border border-[#e8ebee] bg-white px-[12px] text-[14px] font-medium text-[#191f28] outline-none placeholder:text-[#757575] focus:border-[#14a497]"
            />
            {errors.title && (
              <p id="notice-title-error" className="text-[12px] font-medium text-[#f04452]">{errors.title.message}</p>
            )}
          </div>

          {/* 내용 */}
          <div className="flex flex-col gap-[9px]">
            <label htmlFor="notice-content" className="text-[12.5px] font-bold leading-[normal] text-[#8b95a1]">내용</label>
            <Textarea
              unstyled
              id="notice-content"
              {...register("content")}
              maxLength={10000}
              placeholder="일시 · 대상 · 내용 순으로 적어 주세요"
              aria-invalid={errors.content ? true : undefined}
              aria-describedby={errors.content ? "notice-content-error" : undefined}
              className="h-[150px] w-full resize-none rounded-[11px] border border-[#e8ebee] bg-white px-[13px] py-[12px] text-[13.5px] font-medium leading-[22.95px] text-[#191f28] outline-none placeholder:text-[#757575] focus:border-[#14a497]"
            />
            {errors.content && (
              <p id="notice-content-error" className="text-[12px] font-medium text-[#f04452]">{errors.content.message}</p>
            )}
          </div>

          {/* 대상 건물 */}
          <NoticeTargetBuildings buildings={buildings} value={targets} onChange={setTargets} />

          {errors.root?.server?.message && (
            <p role="alert" className="rounded-[11px] bg-[#fff1f1] px-[13px] py-[10px] text-[13px] font-semibold text-[#f04452]">
              {errors.root.server.message}
            </p>
          )}

          {/* 푸터 */}
          <div className="flex w-full gap-[8px]">
            <button
              type="button"
              onClick={closeSafely}
              disabled={isPending}
              className="flex h-[40px] flex-1 items-center justify-center rounded-[11px] bg-[#f2f4f6] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-[#4e5968] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-[40px] flex-1 items-center justify-center rounded-[11px] bg-[#14a497] px-[18px] text-[13.5px] font-bold tracking-[-0.135px] text-white disabled:opacity-60"
            >
              {editing ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
