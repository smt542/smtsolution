import { createClient } from "@/lib/supabase/client";

export interface QuickMessage { id: number; orgId: number; title: string; body: string; sortOrder: number; }
export interface QuickMessageInput { orgId: number; title: string; body: string; sortOrder?: number; }

const toRow = (r: any): QuickMessage => ({ id: r.id, orgId: r.org_id, title: r.title, body: r.body, sortOrder: r.sort_order });

function inputToRow(i: Partial<QuickMessageInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("title", i.title); set("body", i.body); set("sort_order", i.sortOrder);
  return r;
}

export async function listQuickMessages(): Promise<QuickMessage[]> {
  const { data, error } = await createClient().from("quick_messages").select("*").is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRow);
}
export async function createQuickMessage(input: QuickMessageInput): Promise<QuickMessage> {
  const { data, error } = await createClient().from("quick_messages").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function updateQuickMessage(id: number, input: Partial<QuickMessageInput>): Promise<QuickMessage> {
  const { data, error } = await createClient().from("quick_messages").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function deleteQuickMessage(id: number): Promise<void> {
  const { error } = await createClient().from("quick_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
