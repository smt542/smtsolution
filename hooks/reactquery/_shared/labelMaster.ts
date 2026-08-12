import { createClient } from "@/lib/supabase/client";

export interface LabelMasterRow { id: number; orgId: number; label: string; sortOrder: number; }
export interface LabelMasterInput { orgId: number; label: string; sortOrder?: number; }

const toRow = (r: any): LabelMasterRow => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order });

export function makeLabelMasterApis(table: string) {
  return {
    async list(): Promise<LabelMasterRow[]> {
      const { data, error } = await createClient().from(table).select("*").is("deleted_at", null).order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []).map(toRow);
    },
    async create(input: LabelMasterInput): Promise<LabelMasterRow> {
      const row: Record<string, unknown> = { org_id: input.orgId, label: input.label };
      if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
      const { data, error } = await createClient().from(table).insert(row).select().single();
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
