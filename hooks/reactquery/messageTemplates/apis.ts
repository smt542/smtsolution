import { createClient } from "@/lib/supabase/client";

/**
 * 템플릿 버튼. 화면 등록분은 {name,type,url}, 팝빌 승인 템플릿(동기화·기본 제공)은 팝빌 원문 {t,n,u1,u2} 형식이다.
 * 발송은 두 형식 모두 toPopbillButtons 로 받는다.
 */
export interface TemplateButton { name?: string; type?: string; url?: string; t?: string; n?: string; u1?: string; u2?: string }
export interface MessageTemplate {
  id: number; orgId: number; title: string; body: string; sortOrder: number;
  category: string | null; channelType: string; alimtalkTemplateCode: string | null; buttons: TemplateButton[];
}
export interface MessageTemplateInput {
  orgId: number; title: string; body: string; sortOrder?: number;
  category?: string | null; channelType?: string; alimtalkTemplateCode?: string | null; buttons?: TemplateButton[];
}

type Row = {
  id: number; org_id: number; title: string; body: string; sort_order: number;
  category?: string | null; channel_type?: string | null; alimtalk_template_code?: string | null; buttons?: unknown;
};
const toRow = (r: Row): MessageTemplate => ({
  id: r.id, orgId: r.org_id, title: r.title, body: r.body, sortOrder: r.sort_order,
  category: r.category ?? null,
  channelType: r.channel_type ?? "sms",
  alimtalkTemplateCode: r.alimtalk_template_code ?? null,
  buttons: Array.isArray(r.buttons) ? (r.buttons as TemplateButton[]) : [],
});

function inputToRow(i: Partial<MessageTemplateInput>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) r[k] = v; };
  set("org_id", i.orgId); set("title", i.title); set("body", i.body); set("sort_order", i.sortOrder);
  set("category", i.category); set("channel_type", i.channelType);
  set("alimtalk_template_code", i.alimtalkTemplateCode); set("buttons", i.buttons);
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
