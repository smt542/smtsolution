import { createClient } from "@/lib/supabase/client";

export interface MessageTemplate { id: number; orgId: number; title: string; body: string; sortOrder: number; }
export interface MessageTemplateInput { orgId: number; title: string; body: string; sortOrder?: number; }

type Row = { id: number; org_id: number; title: string; body: string; sort_order: number };
const toRow = (r: Row): MessageTemplate => ({ id: r.id, orgId: r.org_id, title: r.title, body: r.body, sortOrder: r.sort_order });

function inputToRow(i: Partial<MessageTemplateInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("title", i.title); set("body", i.body); set("sort_order", i.sortOrder);
  return r;
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const { data, error } = await createClient().from("message_templates").select("*").is("deleted_at", null).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRow);
}
export async function createMessageTemplate(input: MessageTemplateInput): Promise<MessageTemplate> {
  const { data, error } = await createClient().from("message_templates").insert(inputToRow(input)).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function updateMessageTemplate(id: number, input: Partial<MessageTemplateInput>): Promise<MessageTemplate> {
  const { data, error } = await createClient().from("message_templates").update(inputToRow(input)).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return toRow(data);
}
export async function deleteMessageTemplate(id: number): Promise<void> {
  const { error } = await createClient().from("message_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}
