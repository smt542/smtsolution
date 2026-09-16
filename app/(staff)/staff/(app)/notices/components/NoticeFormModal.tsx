"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Modal, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import { NoticeEditor } from "@/components/notices/NoticeEditor";
import { NoticeTargetChip } from "./NoticeTargetChip";
import {
  EMPTY_NOTICE_DOC,
  noticeDocToPlainText,
  plainTextToNoticeDoc,
} from "@/lib/notice/richText";
import {
  createNoticeFormSchema,
  type NoticeFormInput,
  type NoticeFormValues,
} from "@/components/forms/schema/notice";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  finalizeNoticeImages,
  prepareNoticeImages,
  removeNoticeImageObjects,
  useCreateNotice,
  useUpdateNotice,
  type Notice,
  type NoticeInput,
} from "@/hooks/reactquery/notices";
import {
  getPublishMode,
  toDateTimeLocal,
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
  const initialPublishMode: PublishMode = mode;
  const schema = useMemo(() => createNoticeFormSchema(), []);
  const makeDefaults = (): NoticeFormInput => ({
    buildingIds: editing?.buildingIds ?? [],
    noticeType: editing?.noticeType ?? "normal",
    title: editing?.title ?? "",
    contentJson: editing ? (editing.contentJson ?? plainTextToNoticeDoc(editing.content)) : EMPTY_NOTICE_DOC,
    publishMode: mode,
    scheduledAt: mode === "scheduled" ? toDateTimeLocal(editing?.publishedAt) : "",
    expiresAt: toDateTimeLocal(editing?.expiresAt),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NoticeFormInput, unknown, NoticeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const publishMode = useWatch({ control, name: "publishMode" });
  // 저장 전 새 본문 이미지 File을 담는 공유 맵(렌더마다 안정된 인스턴스). 편집기가 in-place로
  // 채우고 저장 오케스트레이션이 읽는다. ref.current를 렌더 중 넘기지 않으려고 state로 보관한다.
  const [pendingFiles] = useState<Map<string, File>>(() => new Map());
  const isNoticeSavePending = createNotice.isPending || updateNotice.isPending || isSubmitting;
  const closeSafely = () => {
    if (!isNoticeSavePending) onClose();
  };

  const submit = async (values: NoticeFormValues) => {
    // 1) pending 이미지를 Storage에 업로드하고 content_json을 object path로 치환한다.
    let prepared: Awaited<ReturnType<typeof prepareNoticeImages>>;
    try {
      prepared = await prepareNoticeImages({
        orgId,
        doc: values.contentJson,
        pendingFiles,
      });
    } catch (uploadError) {
      toast.error(uploadError, "본문 이미지를 업로드하지 못했습니다.");
      return;
    }
    const { nextDoc, uploaded, failedCount } = prepared;
    if (failedCount > 0) {
      toast.warning(`본문 이미지 ${failedCount}장을 업로드하지 못해 제외했습니다.`);
    }

    const now = new Date().toISOString();
    const publishedAt = values.publishMode === "draft"
      ? null
      : values.publishMode === "scheduled"
        ? values.scheduledAt
        : editing && initialPublishMode === "now" && editing.publishedAt
          ? editing.publishedAt
          : now;

    const payload: NoticeInput = {
      orgId,
      buildingIds: values.buildingIds,
      noticeType: values.noticeType,
      title: values.title,
      content: noticeDocToPlainText(nextDoc),
      contentJson: nextDoc,
      publishedAt,
      expiresAt: values.publishMode === "draft" ? null : values.expiresAt,
    };

    try {
      // 2) 치환된 content_json으로 공지를 저장한다.
      const saved = editing
        ? await updateNotice.mutateAsync({ id: editing.id, input: payload })
        : await createNotice.mutateAsync(payload);
      // 3) 업로드분 첨부 row 생성 + 본문에서 빠진 이미지 정리(부분 실패는 경고만).
      try {
        const { rowFailedCount } = await finalizeNoticeImages({
          orgId,
          noticeId: saved.id,
          uploaded,
          previousDoc: editing?.contentJson ?? null,
          nextDoc,
        });
        if (rowFailedCount > 0) {
          toast.warning("본문 이미지 일부의 첨부 정보 저장에 실패했습니다.");
        }
      } catch {
        toast.warning("본문 이미지 정리 중 일부 작업에 실패했습니다.");
      }
      toast.success(editing ? "공지가 수정되었습니다." : "공지가 등록되었습니다.");
      onSaved(saved);
      reset(makeDefaults());
      onClose();
    } catch (saveError) {
      // 저장 실패 시 방금 업로드한 object를 보상 삭제해 고아를 남기지 않는다.
      if (uploaded.length > 0) {
        try {
          await removeNoticeImageObjects(uploaded.map((image) => image.path));
        } catch {
          // 보상 삭제 실패는 무시(저장 자체가 실패했으므로 참조는 남지 않는다).
        }
      }
      toast.error(saveError, "공지를 저장하지 못했습니다.");
      setSubmissionError(saveError, setError, "공지를 저장하지 못했습니다.");
    }
  };

  return (
    <Modal open={open} onClose={closeSafely} title={editing ? "공지 수정" : "공지 등록"}>
      <form onSubmit={handleSubmit(submit)} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1" noValidate>
        <FormField htmlFor="notice-buildings" label="공지 대상 *" hint="전체 공지이거나 하나 이상의 건물을 선택할 수 있습니다.">
          <Controller
            control={control}
            name="buildingIds"
            render={({ field }) => {
              const ids = field.value ?? [];
              return (
                <div className="flex flex-wrap gap-[8px]">
                  <NoticeTargetChip label="전체 건물" checked={ids.length === 0} onClick={() => field.onChange([])} />
                  {buildings.map((building) => (
                    <NoticeTargetChip
                      key={building.id}
                      label={building.name}
                      checked={ids.includes(building.id)}
                      onClick={() =>
                        field.onChange(
                          ids.includes(building.id)
                            ? ids.filter((x) => x !== building.id)
                            : [...ids, building.id],
                        )
                      }
                    />
                  ))}
                </div>
              );
            }}
          />
        </FormField>

        <FormField htmlFor="notice-type" label="공지 유형 *" error={errors.noticeType?.message}>
          <Select
            id="notice-type"
            {...register("noticeType")}
            options={[
              { value: "normal", label: "일반" },
              { value: "important", label: "중요" },
              { value: "urgent", label: "긴급" },
            ]}
          />
        </FormField>

        <FormField htmlFor="notice-title" label="제목 *" error={errors.title?.message}>
          <Input id="notice-title" {...register("title")} maxLength={200} placeholder="공지 제목" />
        </FormField>

        <FormField htmlFor="notice-content" label="내용 *" error={(errors.contentJson as { message?: string } | undefined)?.message}>
          <Controller
            control={control}
            name="contentJson"
            render={({ field }) => (
              <NoticeEditor
                aria-label="공지 내용"
                aria-invalid={Boolean(errors.contentJson)}
                aria-describedby={errors.contentJson ? "notice-content-error" : undefined}
                value={field.value ?? EMPTY_NOTICE_DOC}
                onChange={field.onChange}
                pendingFiles={pendingFiles}
              />
            )}
          />
        </FormField>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-t2">게시 방식 *</legend>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["now", "즉시 게시"],
              ["scheduled", "예약 게시"],
              ["draft", "초안 저장"],
            ] as const).map(([value, label]) => (
              <label key={value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold ${publishMode === value ? "border-brand bg-blue-t text-blue-d" : "border-line text-t2"}`}>
                <input type="radio" value={value} {...register("publishMode")} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {publishMode === "scheduled" && (
          <FormField htmlFor="notice-scheduled-at" label="예약 게시 일시 *" error={errors.scheduledAt?.message}>
            <Input id="notice-scheduled-at" type="datetime-local" {...register("scheduledAt")} />
          </FormField>
        )}

        {publishMode !== "draft" && (
          <FormField htmlFor="notice-expires-at" label="게시 종료 일시" error={errors.expiresAt?.message} hint="비워 두면 종료 없이 계속 게시됩니다.">
            <Input id="notice-expires-at" type="datetime-local" {...register("expiresAt")} />
          </FormField>
        )}

        {errors.root?.server?.message && <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">{errors.root.server.message}</p>}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface pt-4">
          <Button type="button" variant="ghost" onClick={closeSafely} disabled={isNoticeSavePending}>취소</Button>
          <Button type="submit" variant="primary" disabled={isNoticeSavePending}>
            {isNoticeSavePending ? "저장 중…" : editing ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
