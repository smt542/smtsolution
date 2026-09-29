"use client";

import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  type MessageTemplate,
  type TemplateButton,
  useDeleteMessageTemplate,
  useMessageTemplates,
} from "@/hooks/reactquery/messageTemplates";
import {
  fetchPopbillConsoleUrls,
  useSyncAlimtalkTemplates,
} from "@/hooks/reactquery/messageTemplates/popbillSync";
import { MessagingListCard } from "./MessagingListCard";
import { SegmentedFilter } from "./SegmentedFilter";
import { TemplateFormModal } from "./TemplateFormModal";

type FilterType = "all" | "sms" | "alimtalk";

function isSystemTemplate(t: MessageTemplate): boolean {
  return t.sortOrder >= 100;
}

function getChannelLabel(channelType: string): string {
  if (channelType === "alimtalk") return "알림톡";
  return "문자";
}

function getLinkContent(
  buttons: TemplateButton[] | undefined,
): { name: string; url: string } | null {
  const btn = buttons?.[0];
  if (!btn?.url) return null;
  return { name: btn.name, url: btn.url };
}

function summarizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "sms", label: "문자" },
  { value: "alimtalk", label: "알림톡" },
];

const HEADERS = ["템플릿", "구분", "템플릿명", "템플릿 내용", "링크", ""];

const TH =
  "px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1] whitespace-nowrap";

export function TemplatesTab() {
  const confirm = useConfirm();
  const {
    data: templates = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useMessageTemplates();
  const deleteTemplate = useDeleteMessageTemplate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const syncTemplates = useSyncAlimtalkTemplates();
  const isRefreshing = isFetching && !isLoading;

  const openCreate = () => setIsFormOpen(true);
  const closeForm = () => {
    setIsFormOpen(false);
    setEditTemplate(null);
  };

  const openPopbillConsole = async () => {
    setConsoleLoading(true);
    try {
      const { templateUrl } = await fetchPopbillConsoleUrls();
      if (templateUrl) window.open(templateUrl, "_blank", "noopener,noreferrer");
      else toast.error("콘솔 주소를 받지 못했습니다.");
    } catch (e) {
      toast.error(e, "팝빌 콘솔을 열지 못했습니다.");
    } finally {
      setConsoleLoading(false);
    }
  };

  const runPopbillSync = async () => {
    try {
      const { synced } = await syncTemplates.mutateAsync();
      toast.success(`팝빌 승인 템플릿 ${synced}건을 동기화했습니다.`);
    } catch (e) {
      toast.error(e, "동기화 실패");
    }
  };

  const remove = async (template: MessageTemplate) => {
    const ok = await confirm({
      title: "템플릿 삭제",
      description: `'${template.title}' 템플릿을 삭제하시겠습니까?`,
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success("삭제했습니다.");
    } catch (e) {
      toast.error(e, "삭제 실패");
    }
  };

  const filtered = templates.filter((t) => {
    if (filter === "sms") return t.channelType === "sms";
    if (filter === "alimtalk") return t.channelType === "alimtalk";
    return true;
  });

  return (
    <>
      <MessagingListCard
        title="템플릿 관리"
        count={filtered.length}
        refreshing={isRefreshing}
        refreshingLabel="템플릿 목록 갱신 중"
        isLoading={isLoading}
        loadingLabel="템플릿 목록 불러오는 중"
        error={error}
        errorMessage="템플릿을 불러오지 못했습니다."
        onRetry={() => void refetch()}
        isEmpty={filtered.length === 0}
        emptyMessage={
          templates.length === 0
            ? "등록된 템플릿이 없습니다."
            : "해당 조건의 템플릿이 없습니다."
        }
        actions={
          <>
            <SegmentedFilter
              ariaLabel="템플릿 채널 필터"
              options={FILTERS}
              value={filter}
              onChange={(value) => setFilter(value)}
            />
            <button
              type="button"
              onClick={() => void openPopbillConsole()}
              disabled={consoleLoading}
              className="flex h-[34px] items-center justify-center rounded-[9px] border border-[#e8ebee] bg-white px-[14px] text-[13px] font-bold text-[#4e5968] disabled:opacity-50"
            >
              {consoleLoading ? "여는 중…" : "팝빌에서 관리"}
            </button>
            <button
              type="button"
              onClick={() => void runPopbillSync()}
              disabled={syncTemplates.isPending}
              className="flex h-[34px] items-center justify-center rounded-[9px] border border-[#14a497] bg-white px-[14px] text-[13px] font-bold text-[#14a497] disabled:opacity-50"
            >
              {syncTemplates.isPending ? "동기화 중…" : "팝빌 동기화"}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="flex h-[34px] items-center justify-center rounded-[9px] border border-[#14a497] bg-[#14a497] px-[16px] text-[13px] font-bold leading-[normal] text-white"
            >
              템플릿 등록
            </button>
          </>
        }
      >
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-[#e8ebee] bg-[#fbfcfd]">
              {HEADERS.map((heading, i) => (
                <th key={i} className={TH}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((template) => {
              const sys = isSystemTemplate(template);
              const link = getLinkContent(template.buttons);
              return (
                <tr
                  key={template.id}
                  onClick={() => setEditTemplate(template)}
                  className="cursor-pointer border-b border-[#f1f3f5] last:border-b-0 hover:bg-row-hover"
                >
                  <td className="whitespace-nowrap h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {getChannelLabel(template.channelType)}
                  </td>
                  <td className="whitespace-nowrap h-[49px] px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                    {template.category ?? "-"}
                  </td>
                  <td className="h-[49px] px-[16px] py-[12px]">
                    <div className="flex items-center gap-[6px]">
                      <span className="whitespace-nowrap text-[13px] font-semibold text-[#191f28]">
                        {template.title}
                      </span>
                      {sys && (
                        <span className="shrink-0 rounded-[6px] bg-[#f2f4f6] px-[7px] py-[2px] text-[11px] font-bold leading-[normal] text-[#8b95a1]">
                          기본
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-0 overflow-hidden h-[49px] px-[16px] py-[12px]">
                    <p
                      className="truncate text-[13px] font-medium text-[#191f28]"
                      title={template.body}
                    >
                      {summarizeBody(template.body)}
                    </p>
                  </td>
                  <td className="w-[200px] overflow-hidden h-[49px] px-[16px] py-[12px]">
                    {link ? (
                      <p className="truncate text-[13px]">
                        <span className="font-medium text-[#191f28]">
                          {link.name}
                        </span>
                        <span className="font-normal text-[#8b95a1]">
                          {` · ${link.url}`}
                        </span>
                      </p>
                    ) : (
                      <span className="text-[13px] text-[#8b95a1]">-</span>
                    )}
                  </td>
                  <td className="w-[100px] h-[49px] px-[16px] py-[12px]">
                    {!sys && (
                      <button
                        type="button"
                        disabled={deleteTemplate.isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void remove(template);
                        }}
                        aria-label={`${template.title} 삭제`}
                        className="text-[12.5px] font-bold text-[#f04452] disabled:opacity-50"
                      >
                        {deleteTemplate.isPending ? "삭제 중…" : "삭제"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </MessagingListCard>

      <TemplateFormModal
        open={isFormOpen || editTemplate !== null}
        template={editTemplate ?? undefined}
        onClose={closeForm}
        onSaved={closeForm}
      />
    </>
  );
}
