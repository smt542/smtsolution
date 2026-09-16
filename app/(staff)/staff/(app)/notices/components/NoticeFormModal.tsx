"use client";

import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Modal, Select, Textarea } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import { NoticeTargetChip } from "./NoticeTargetChip";
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
    content: editing?.content ?? "",
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
  const isNoticeSavePending = createNotice.isPending || updateNotice.isPending || isSubmitting;
  const closeSafely = () => {
    if (!isNoticeSavePending) onClose();
  };

  const submit = async (values: NoticeFormValues) => {
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
      content: values.content,
      contentJson: plainTextToNoticeDoc(values.content),
      publishedAt,
      expiresAt: values.publishMode === "draft" ? null : values.expiresAt,
    };

    try {
      const saved = editing
        ? await updateNotice.mutateAsync({ id: editing.id, input: payload })
        : await createNotice.mutateAsync(payload);
      toast.success(editing ? "공지가 수정되었습니다." : "공지가 등록되었습니다.");
      onSaved(saved);
      reset(makeDefaults());
      onClose();
    } catch (saveError) {
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

        <FormField htmlFor="notice-content" label="내용 *" error={errors.content?.message}>
          <Textarea id="notice-content" {...register("content")} rows={6} maxLength={10000} placeholder="공지 내용" />
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
