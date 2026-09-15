"use client";
import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Input, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useAsCategories, useCreateAsCategory, useRenameAsCategory, useDeleteAsCategory,
} from "@/hooks/reactquery/asCategories";

const MAX = 6;

// A/S 접수 유형 — 시스템 설정의 "AS 구분"(as_categories)과 동일 데이터를 공유한다.
// 프로토타입: 최대 6개, 번호 매김 편집 행, N/6 배지, ＋ 유형 추가.
export function AsSettingsTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data } = useAsCategories();
  const cats = data ?? [];
  const create = useCreateAsCategory();
  const rename = useRenameAsCategory();
  const remove = useDeleteAsCategory();

  const [labels, setLabels] = useState<Record<number, string>>({});
  const [draft, setDraft] = useState<string | null>(null);

  // data(쿼리 원본)를 의존성으로 — 기본값 []를 쓰면 매 렌더 새 참조라 무한 루프.
  useEffect(() => {
    if (!data) return;
    setLabels.call(undefined, Object.fromEntries(data.map((c) => [c.id, c.label])));
  }, [data]);

  const count = cats.length + (draft !== null ? 1 : 0);

  const commitRename = async (id: number, original: string) => {
    const v = (labels[id] ?? "").trim();
    if (!v) { setLabels((p) => ({ ...p, [id]: original })); return; }
    if (v === original) return;
    try { await rename.mutateAsync({ id, label: v }); }
    catch (e) { setLabels((p) => ({ ...p, [id]: original })); toast.error(e, "A/S 유형 이름을 변경하지 못했습니다."); }
  };

  const commitDraft = async () => {
    const v = (draft ?? "").trim();
    if (!v) { setDraft(null); return; }
    if (!orgId) { toast.error("인증 정보가 없습니다"); return; }
    try { await create.mutateAsync({ orgId, label: v }); setDraft(null); }
    catch (e) { toast.error(e, "A/S 유형을 추가하지 못했습니다."); }
  };

  const onDelete = async (id: number) => {
    if (cats.length <= 1) { toast.error("최소 1개 유형은 있어야 해요"); return; }
    try { await remove.mutateAsync(id); }
    catch (e) { toast.error(e, "A/S 유형을 삭제하지 못했습니다."); }
  };

  return (
    <Panel
      title="A/S 접수 유형"
      action={<span className="text-sm font-bold text-t3 tabular-nums">{count} / {MAX}</span>}
    >
      <p className="mb-4 text-sm text-t3">A/S 접수 화면의 유형 선택에 노출돼요 · 최대 {MAX}개</p>
      <div className="flex flex-col gap-2">
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-line2 bg-bg px-3 py-2">
            <span className="w-5 flex-none text-center text-xs font-bold text-t4 tabular-nums">{i + 1}</span>
            <Input
              aria-label={`유형 ${i + 1}`}
              className="h-9 flex-1 bg-surface"
              value={labels[c.id] ?? ""}
              placeholder="유형명"
              onChange={(e) => setLabels((p) => ({ ...p, [c.id]: e.target.value }))}
              onBlur={() => commitRename(c.id, c.label)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            <button
              type="button"
              aria-label={`${c.label} 삭제`}
              onClick={() => onDelete(c.id)}
              className="flex-none rounded-lg p-1.5 text-t4 hover:bg-danger/10 hover:text-danger"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
        {draft !== null && (
          <div className="flex items-center gap-2 rounded-xl border border-line2 bg-bg px-3 py-2">
            <span className="w-5 flex-none text-center text-xs font-bold text-t4 tabular-nums">{cats.length + 1}</span>
            <Input
              aria-label="새 유형"
              autoFocus
              className="h-9 flex-1 bg-surface"
              value={draft}
              placeholder="유형명"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setDraft(null); }}
            />
            <button
              type="button"
              aria-label="새 유형 취소"
              onClick={() => setDraft(null)}
              className="flex-none rounded-lg p-1.5 text-t4 hover:bg-danger/10 hover:text-danger"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDraft("")}
        disabled={count >= MAX || draft !== null}
        className="mt-3 h-9 rounded-xl border border-dashed border-line bg-surface px-4 text-sm font-bold text-t2 hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-45"
      >
        ＋ 유형 추가
      </button>
    </Panel>
  );
}
