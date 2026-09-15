"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  type MessageTemplate,
  type TemplateButton,
  useDeleteMessageTemplate,
  useMessageTemplates,
} from "@/hooks/reactquery/messageTemplates";
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

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "sms", label: "문자" },
  { key: "alimtalk", label: "알림톡" },
];

const HEADERS = ["템플릿", "구분", "템플릿명", "템플릿 내용", "링크", ""];

export function TemplatesTab() {
  const confirm = useConfirm();
  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
  } = useMessageTemplates();
  const deleteTemplate = useDeleteMessageTemplate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const openCreate = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

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
      toast.error(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  const filtered = templates.filter((t) => {
    if (filter === "sms") return t.channelType === "sms";
    if (filter === "alimtalk") return t.channelType === "alimtalk";
    return true;
  });

  return (
    <>
      <div className="overflow-hidden rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
        {/* Card header */}
        <div className="flex items-center gap-[8px] border-b border-[#f1f3f5] px-[18px] py-[15px]">
          <span className="text-[15px] font-extrabold leading-normal text-[#191f28]">
            템플릿 관리
          </span>
          <span className="text-[13px] font-semibold leading-normal text-[#8b95a1]">
            {templates.length}
          </span>
          <div className="flex-1" />
          {/* Type filter */}
          <div className="flex items-start gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={
                  filter === key
                    ? "rounded-[7px] bg-white px-[11px] py-[5px] text-[12px] font-bold leading-normal text-[#191f28] drop-shadow-[0px_1px_1.5px_rgba(23,31,40,0.1)]"
                    : "rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-normal text-[#8b95a1]"
                }
              >
                {label}
              </button>
            ))}
          </div>
          {/* Register button */}
          <button
            type="button"
            onClick={openCreate}
            className="flex h-[34px] items-center justify-center rounded-[9px] border border-[#14a497] bg-[#14a497] px-[16px] text-[13px] font-bold leading-normal text-white"
          >
            템플릿 등록
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div
            aria-label="템플릿 목록 불러오는 중"
            className="flex flex-col items-center gap-2 py-10"
          >
            <Spinner />
            <p className="text-center text-[13px] text-[#8b95a1]">
              템플릿 목록을 불러오는 중입니다.
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-[14px] font-bold text-[#191f28]">
              템플릿을 불러오지 못했습니다.
            </p>
            <button
              type="button"
              className="mt-4 text-[13px] text-[#14a497]"
              onClick={() => void refetch()}
            >
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#8b95a1]">
            {templates.length === 0
              ? "등록된 템플릿이 없습니다."
              : "해당 조건의 템플릿이 없습니다."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="border-b border-[#e8ebee] bg-[#fbfcfd]">
                  {HEADERS.map((heading, i) => (
                    <th
                      key={i}
                      className="px-[16px] py-[11px] text-left text-[12px] font-bold text-[#8b95a1]"
                    >
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
                      className="border-b border-[#f1f3f5] last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                        {getChannelLabel(template.channelType)}
                      </td>
                      <td className="whitespace-nowrap px-[16px] py-[12px] text-[13px] font-medium text-[#191f28]">
                        {template.category ?? "-"}
                      </td>
                      <td className="px-[16px] py-[12px]">
                        <div className="flex items-center gap-[6px]">
                          <span className="whitespace-nowrap text-[13px] font-semibold text-[#191f28]">
                            {template.title}
                          </span>
                          {sys && (
                            <span className="shrink-0 rounded-[6px] bg-[#f2f4f6] px-[7px] py-[2px] text-[11px] font-bold leading-normal text-[#8b95a1]">
                              기본
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-0 overflow-hidden px-[16px] py-[12px]">
                        <p
                          className="truncate text-[13px] font-medium text-[#191f28]"
                          title={template.body}
                        >
                          {summarizeBody(template.body)}
                        </p>
                      </td>
                      <td className="w-[200px] overflow-hidden px-[16px] py-[12px]">
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
                      <td className="w-[100px] px-[16px] py-[12px]">
                        {!sys && (
                          <button
                            type="button"
                            disabled={deleteTemplate.isPending}
                            onClick={() => void remove(template)}
                            aria-label={`${template.title} 삭제`}
                            className="text-[12.5px] font-bold text-[#f04452] disabled:opacity-50"
                          >
                            삭제
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TemplateFormModal
        open={isFormOpen}
        onClose={closeForm}
        onSaved={closeForm}
      />
    </>
  );
}
