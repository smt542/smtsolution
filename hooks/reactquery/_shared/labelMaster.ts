import { createClient } from "@/lib/supabase/client";

export interface LabelMasterRow { id: number; orgId: number; label: string; sortOrder: number; }
export interface LabelMasterInput { orgId: number; label: string; sortOrder?: number; }

type LabelMasterDbRow = { id: number; org_id: number; label: string; sort_order: number };

const toRow = (r: LabelMasterDbRow): LabelMasterRow => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order });

export function makeLabelMasterApis(table: string) {
  return {
    async list(): Promise<LabelMasterRow[]> {
      // 정렬값이 같으면 순서가 정해지지 않아 새로고침마다 섞인다 → 만든 순서(id)로 고정한다.
      const { data, error } = await createClient().from(table).select("*").is("deleted_at", null).order("sort_order").order("id");
      if (error) throw new Error(error.message);
      return (data ?? []).map(toRow);
    },
    async create(input: LabelMasterInput): Promise<LabelMasterRow> {
      const client = createClient();
      let sortOrder = input.sortOrder;
      // 새 항목은 목록 맨 뒤에 붙는다. 정렬값을 비우면 DB 기본값 0이 들어가 맨 앞에 끼어든다(3차 QA).
      if (sortOrder === undefined) {
        const { data: last, error: lastError } = await client
          .from(table)
          .select("sort_order")
          .eq("org_id", input.orgId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastError) throw new Error(lastError.message);
        sortOrder = (last?.sort_order ?? 0) + 10;
      }
      const { data, error } = await client
        .from(table)
        .insert({ org_id: input.orgId, label: input.label, sort_order: sortOrder })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toRow(data);
    },
    async rename(id: number, label: string): Promise<LabelMasterRow> {
      const { data, error } = await createClient().from(table).update({ label }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return toRow(data);
    },
    async softDelete(id: number): Promise<void> {
      const { error } = await createClient().from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
