"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  DataTable,
  EmptyState,
  Panel,
  Spinner,
} from "@/components/common";
import {
  type MessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
} from "@/hooks/reactquery/messageTemplates";
import { extractVariables } from "@/lib/messaging/render";
import { TemplateFormModal } from "./TemplateFormModal";

function summarizeBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.length > 60
    ? `${normalized.slice(0, 60)}…`
    : normalized;
}

export function TemplatesTab() {
  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
  } = useMessageTemplates();
  const deleteTemplate = useDeleteMessageTemplate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate>();

  const openCreate = () => {
    setEditingTemplate(undefined);
    setIsFormOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const remove = async (template: MessageTemplate) => {
    if (!window.confirm(`'${template.title}' 템플릿을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success("삭제했습니다.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "삭제 실패",
      );
    }
  };

  const action = (
    <Button type="button" onClick={openCreate}>
      새 템플릿
    </Button>
  );

  let content;
  if (isLoading) {
    content = (
      <div aria-label="템플릿 목록 불러오는 중" className="py-8">
        <Spinner />
        <p className="text-center text-sm text-t4">
          템플릿 목록을 불러오는 중입니다.
        </p>
      </div>
    );
  } else if (error) {
    content = (
      <div role="alert" className="py-8 text-center">
        <p className="font-bold text-t1">템플릿을 불러오지 못했습니다.</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-4"
          onClick={() => void refetch()}
        >
          다시 시도
        </Button>
      </div>
    );
  } else if (templates.length === 0) {
    content = <EmptyState message="등록된 템플릿이 없습니다." />;
  } else {
    const columns = [
      { key: "title", label: "제목" },
      { key: "body", label: "본문 요약" },
      { key: "variables", label: "사용 변수" },
      { key: "actions", label: "관리" },
    ];
    const rows = templates.map((template) => {
      const variables = extractVariables(template.body);
      return {
        title: template.title,
        body: (
          <span title={template.body}>{summarizeBody(template.body)}</span>
        ),
        variables:
          variables.length === 0 ? (
            <span className="text-t4">-</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <span
                  key={variable}
                  className="rounded-lg bg-brand/10 px-2 py-1 text-xs font-bold text-brand"
                >
                  {variable}
                </span>
              ))}
            </div>
          ),
        actions: (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3"
              aria-label={`${template.title} 수정`}
              onClick={() => openEdit(template)}
            >
              수정
            </Button>
            <Button
              type="button"
              variant="danger"
              className="h-9 px-3"
              aria-label={`${template.title} 삭제`}
              disabled={deleteTemplate.isPending}
              onClick={() => void remove(template)}
            >
              삭제
            </Button>
          </div>
        ),
      };
    });
    content = <DataTable columns={columns} rows={rows} />;
  }

  return (
    <>
      <Panel title="알림톡 템플릿" action={action}>
        {content}
      </Panel>
      <TemplateFormModal
        open={isFormOpen}
        template={editingTemplate}
        onClose={closeForm}
        onSaved={closeForm}
      />
    </>
  );
}
