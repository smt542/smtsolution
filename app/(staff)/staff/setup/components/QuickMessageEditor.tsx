"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Modal } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useQuickMessages, useCreateQuickMessage, useUpdateQuickMessage, useDeleteQuickMessage,
  type QuickMessage,
} from "@/hooks/reactquery/quickMessages";

export function QuickMessageEditor() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data: messages = [] } = useQuickMessages();
  const create = useCreateQuickMessage();
  const update = useUpdateQuickMessage();
  const del = useDeleteQuickMessage();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuickMessage | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const openCreate = () => { setEditing(null); setTitle(""); setBody(""); setOpen(true); };
  const openEdit = (m: QuickMessage) => { setEditing(m); setTitle(m.title); setBody(m.body); setOpen(true); };

  const submit = async () => {
    if (!title.trim() || !body.trim()) { toast.error("제목과 내용을 입력해 주세요"); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: { title, body } });
      else {
        if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
        await create.mutateAsync({ orgId, title, body });
      }
      setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };
  const remove = async (id: number) => {
    try { await del.mutateAsync(id); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-extrabold text-t1">자주 보내는 문자</h4>
        <Button variant="primary" onClick={openCreate}>＋ 추가</Button>
      </div>
      <ul className="flex flex-col gap-1">
        {messages.length === 0 && <li className="py-2 text-sm text-t4">등록된 문자가 없습니다.</li>}
        {messages.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-t2"><b>{m.title}</b> — {m.body}</span>
            <button aria-label={`${m.title} 수정`} onClick={() => openEdit(m)} className="text-xs text-t3 hover:text-brand">수정</button>
            <button aria-label={`${m.title} 삭제`} onClick={() => remove(m.id)} className="text-xs text-t3 hover:text-danger">삭제</button>
          </li>
        ))}
      </ul>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "문자 수정" : "문자 추가"}>
        <div className="flex flex-col gap-3">
          <Input aria-label="문자 제목" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label="문자 내용" placeholder="내용" value={body} onChange={(e) => setBody(e.target.value)}
            className="min-h-24 w-full rounded-xl border border-line bg-surface p-3 text-sm text-t1" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="text-sm text-t3">취소</button>
            <Button variant="primary" onClick={submit} disabled={create.isPending || update.isPending}>{editing ? "저장" : "추가"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
