"use client";
import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { NumberedTagList, nextDefaultLabel, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useAsCategories, useCreateAsCategory, useRenameAsCategory, useDeleteAsCategory,
} from "@/hooks/reactquery/asCategories";

const MAX = 6;

// A/S 접수 유형 — 시스템 설정의 "AS 구분"(as_categories)과 동일 데이터를 공유한다.
// 추가·수정·삭제는 공용 번호 목록에서 바로 저장한다.
export function AsSettingsTab() {
  const { data: me } = useMe();
  const orgId = me?.orgId;
  const { data } = useAsCategories();
  const cats = data ?? [];
  const create = useCreateAsCategory();
  const rename = useRenameAsCategory();
  const remove = useDeleteAsCategory();

  const [labels, setLabels] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!data) return;
    setLabels.call(undefined, Object.fromEntries(data.map((category) => [category.id, category.label])));
  }, [data]);

  /** 입력 중에는 초안만 갱신한다. 저장은 commitRename에서만 한다. */
  const onChange = (id: string, label: string) =>
    setLabels((current) => ({ ...current, [Number(id)]: label }));

  const commitRename = (id: string, label: string) => {
    const numericId = Number(id);
    const original = cats.find((category) => category.id === numericId)?.label ?? "";
    const next = label.trim();
    // 빈 이름이거나 바뀐 게 없으면 저장하지 않고 원래 값으로 되돌린다.
    if (!next || next === original) {
      setLabels((current) => ({ ...current, [numericId]: original }));
      return;
    }
    void rename.mutateAsync({ id: numericId, label: next }).catch((e) => {
      setLabels((current) => ({ ...current, [numericId]: original }));
      toast.error(e, "A/S 유형 이름을 변경하지 못했습니다.");
    });
  };

  const onAdd = () => {
    if (!orgId || cats.length >= MAX) return;
    // as_categories는 (org_id, label)이 유니크라 기본 이름을 그대로 쓰면 두 번째 추가가 실패한다.
    const label = nextDefaultLabel(cats.map((category) => category.label), "새 유형");
    void create.mutateAsync({ orgId, label }).catch((e) => {
      toast.error(e, "A/S 유형을 추가하지 못했습니다.");
    });
  };

  const onDelete = (id: string) => {
    if (cats.length <= 1) { toast.error("최소 1개 유형은 있어야 해요"); return; }
    void remove.mutateAsync(Number(id)).catch((e) => {
      toast.error(e, "A/S 유형을 삭제하지 못했습니다.");
    });
  };

  return (
    <Panel
      title="A/S 접수 유형"
      subtitle={`A/S 접수 화면의 유형 선택에 노출돼요 · 최대 ${MAX}개`}
      variant="compact"
      action={<span className="text-[12px] font-semibold text-t4 tabular-nums">{cats.length} / {MAX}</span>}
    >
      <NumberedTagList
        items={cats.map((category) => ({ id: String(category.id), label: labels[category.id] ?? category.label }))}
        max={MAX}
        columns={5}
        onChange={onChange}
        onCommit={commitRename}
        onDelete={onDelete}
        onAdd={onAdd}
        addLabel="＋ 유형 추가"
      />
    </Panel>
  );
}
