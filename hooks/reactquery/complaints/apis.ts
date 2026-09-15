import { createClient } from "@/lib/supabase/client";

export type ComplaintStatus = "pending" | "completed" | "on_hold" | "repeat";

export interface ComplaintResolution {
  id: number;
  complaintId: number;
  resultContent?: string | null;
  resultNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface Complaint {
  id: number;
  orgId: number;
  buildingId: number;
  unitId?: number | null;
  categoryId?: number | null;
  title: string;
  content?: string | null;
  status: ComplaintStatus;
  reporterName?: string | null;
  reporterPhone?: string | null;
  assignedTo?: string | null;
  receivedAt: string;
  completedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  buildingName?: string | null;
  unitNo?: string | null;
  unitDong?: string | null;
  categoryLabel?: string | null;
  resolutions: ComplaintResolution[];
}

export interface ComplaintInput {
  orgId: number;
  buildingId: number;
  unitId?: number | null;
  categoryId?: number | null;
  title: string;
  content?: string | null;
  status?: ComplaintStatus;
  reporterName?: string | null;
  reporterPhone?: string | null;
  assignedTo?: string | null;
  receivedAt?: string;
  completedAt?: string | null;
  createdBy?: string | null;
}

export interface ComplaintResolutionInput {
  complaintId: number;
  resultContent?: string | null;
  resultNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

export interface ComplaintFilters {
  buildingId?: number;
  categoryId?: number;
  statuses?: ComplaintStatus[];
  receivedFrom?: string;
  receivedTo?: string;
  search?: string;
}

const COMPLAINT_SELECT = `
  *,
  building:buildings(name),
  unit:units(unit_no,dong),
  category:as_categories(label),
  complaint_resolutions(
    id,complaint_id,result_content,result_notes,resolved_by,resolved_at,created_at,updated_at
  )
`;

interface ComplaintResolutionRow {
  id: number;
  complaint_id: number;
  result_content?: string | null;
  result_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface ComplaintRow {
  id: number;
  org_id: number;
  building_id: number;
  unit_id?: number | null;
  category_id?: number | null;
  title: string;
  content?: string | null;
  status: ComplaintStatus;
  reporter_name?: string | null;
  reporter_phone?: string | null;
  assigned_to?: string | null;
  received_at: string;
  completed_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  building?: { name?: string | null } | { name?: string | null }[] | null;
  unit?:
    | { unit_no?: string | null; dong?: string | null }
    | { unit_no?: string | null; dong?: string | null }[]
    | null;
  category?: { label?: string | null } | { label?: string | null }[] | null;
  complaint_resolutions?: ComplaintResolutionRow[] | null;
}

function relatedRow<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export const rowToComplaintResolution = (row: ComplaintResolutionRow): ComplaintResolution => ({
  id: row.id,
  complaintId: row.complaint_id,
  resultContent: row.result_content,
  resultNotes: row.result_notes,
  resolvedBy: row.resolved_by,
  resolvedAt: row.resolved_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const rowToComplaint = (row: ComplaintRow): Complaint => {
  const building = relatedRow<{ name?: string | null }>(row.building);
  const unit = relatedRow<{ unit_no?: string | null; dong?: string | null }>(row.unit);
  const category = relatedRow<{ label?: string | null }>(row.category);
  const resolutions = (row.complaint_resolutions ?? [])
    .map(rowToComplaintResolution)
    .sort((a: ComplaintResolution, b: ComplaintResolution) => {
      const aDate = a.resolvedAt ?? a.createdAt;
      const bDate = b.resolvedAt ?? b.createdAt;
      return bDate.localeCompare(aDate);
    });

  return {
    id: row.id,
    orgId: row.org_id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    categoryId: row.category_id,
    title: row.title,
    content: row.content,
    status: row.status,
    reporterName: row.reporter_name,
    reporterPhone: row.reporter_phone,
    assignedTo: row.assigned_to,
    receivedAt: row.received_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    buildingName: building?.name,
    unitNo: unit?.unit_no,
    unitDong: unit?.dong,
    categoryLabel: category?.label,
    resolutions,
  };
};

function complaintInputToRow(input: Partial<ComplaintInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("org_id", input.orgId);
  set("building_id", input.buildingId);
  set("unit_id", input.unitId);
  set("category_id", input.categoryId);
  set("title", input.title);
  set("content", input.content);
  set("status", input.status);
  set("reporter_name", input.reporterName);
  set("reporter_phone", input.reporterPhone);
  set("assigned_to", input.assignedTo);
  set("received_at", input.receivedAt);
  set("completed_at", input.completedAt);
  set("created_by", input.createdBy);
  return row;
}

function resolutionInputToRow(input: Partial<ComplaintResolutionInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("complaint_id", input.complaintId);
  set("result_content", input.resultContent);
  set("result_notes", input.resultNotes);
  set("resolved_by", input.resolvedBy);
  set("resolved_at", input.resolvedAt);
  return row;
}

export async function listComplaints(filters: ComplaintFilters = {}): Promise<Complaint[]> {
  let query = createClient()
    .from("complaints")
    .select(COMPLAINT_SELECT)
    .is("deleted_at", null);

  if (filters.buildingId !== undefined) query = query.eq("building_id", filters.buildingId);
  if (filters.categoryId !== undefined) query = query.eq("category_id", filters.categoryId);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.receivedFrom) query = query.gte("received_at", filters.receivedFrom);
  if (filters.receivedTo) query = query.lte("received_at", filters.receivedTo);
  if (filters.search?.trim()) {
    const search = filters.search.trim().replaceAll(",", " ");
    query = query.or(
      `title.ilike.%${search}%,content.ilike.%${search}%,reporter_name.ilike.%${search}%,reporter_phone.ilike.%${search}%`,
    );
  }

  const { data, error } = await query.order("received_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToComplaint);
}

export async function getComplaint(id: number): Promise<Complaint> {
  const { data, error } = await createClient()
    .from("complaints")
    .select(COMPLAINT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) throw new Error(error.message);
  return rowToComplaint(data);
}

export async function createComplaint(input: ComplaintInput): Promise<Complaint> {
  const { data, error } = await createClient()
    .from("complaints")
    .insert(complaintInputToRow(input))
    .select(COMPLAINT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToComplaint(data);
}

export async function updateComplaint(
  id: number,
  input: Partial<ComplaintInput>,
): Promise<Complaint> {
  const { data, error } = await createClient()
    .from("complaints")
    .update(complaintInputToRow(input))
    .eq("id", id)
    .select(COMPLAINT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return rowToComplaint(data);
}

export async function updateComplaintStatus(
  id: number,
  status: ComplaintStatus,
): Promise<Complaint> {
  return updateComplaint(id, {
    status,
    completedAt: status === "completed" ? new Date().toISOString() : null,
  });
}

export async function deleteComplaint(id: number): Promise<void> {
  const { error } = await createClient()
    .from("complaints")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listComplaintResolutions(
  complaintId: number,
): Promise<ComplaintResolution[]> {
  const { data, error } = await createClient()
    .from("complaint_resolutions")
    .select("*")
    .eq("complaint_id", complaintId)
    .order("resolved_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToComplaintResolution);
}

export async function createComplaintResolution(
  input: ComplaintResolutionInput,
): Promise<ComplaintResolution> {
  const { data, error } = await createClient()
    .from("complaint_resolutions")
    .insert(resolutionInputToRow(input))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToComplaintResolution(data);
}

export async function updateComplaintResolution(
  id: number,
  input: Partial<ComplaintResolutionInput>,
): Promise<ComplaintResolution> {
  const { data, error } = await createClient()
    .from("complaint_resolutions")
    .update(resolutionInputToRow(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToComplaintResolution(data);
}

export async function deleteComplaintResolution(id: number): Promise<void> {
  const { error } = await createClient()
    .from("complaint_resolutions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface PartnerComplaintDetail {
  id: number;
  building_name: string;
  unit_label: string | null;
  category_id: number | null;
  content: string | null;
  status: string;
  reporter_phone: string | null;
  logger_name: string | null;
  assigned_name: string | null;
  received_at: string;
  completed_at: string | null;
  result_content: string | null;
  is_mine: boolean;
}

export interface PartnerAsCategory {
  id: number;
  label: string;
}

export interface PartnerComplaintEditorData {
  detail: PartnerComplaintDetail | null;
  categories: PartnerAsCategory[];
}

export async function getPartnerComplaintEditor(
  complaintId: number,
): Promise<PartnerComplaintEditorData> {
  const supabase = createClient();
  const [detailResult, categoryResult] = await Promise.all([
    supabase.rpc("partner_get_complaint", { p_id: complaintId }),
    supabase.rpc("partner_list_as_categories"),
  ]);
  if (detailResult.error) throw new Error(detailResult.error.message);
  if (categoryResult.error) throw new Error(categoryResult.error.message);

  return {
    detail: (Array.isArray(detailResult.data)
      ? detailResult.data[0]
      : detailResult.data) as PartnerComplaintDetail | null,
    categories: Array.isArray(categoryResult.data)
      ? (categoryResult.data as PartnerAsCategory[])
      : [],
  };
}

export interface PartnerUnitOption {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  phone: string | null;
}

export async function listPartnerUnits(
  buildingId: number,
): Promise<PartnerUnitOption[]> {
  const { data, error } = await createClient().rpc("partner_list_units", {
    p_building_id: buildingId,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as PartnerUnitOption[]) : [];
}

export interface UpdatePartnerComplaintInput {
  id: number;
  categoryId: number | null;
  content: string;
  status: string;
  completedAt: string | null;
  resultContent: string;
}

export async function updatePartnerComplaint(
  input: UpdatePartnerComplaintInput,
): Promise<void> {
  const { error } = await createClient().rpc("partner_update_complaint", {
    p_id: input.id,
    p_category_id: input.categoryId,
    p_content: input.content,
    p_status: input.status,
    p_completed_at: input.completedAt,
    p_result_content: input.resultContent,
  });
  if (error) throw new Error(error.message);
}

export async function deletePartnerComplaint(id: number): Promise<void> {
  const { error } = await createClient().rpc("partner_delete_complaint", {
    p_id: id,
  });
  if (error) throw new Error(error.message);
}

export interface CreatePartnerComplaintInput {
  buildingId: number;
  unitId: number | null;
  categoryId: number | null;
  content: string;
  status: string;
  completedAt: string | null;
  resultContent: string;
  reporterPhone: string;
}

export async function createPartnerComplaint(
  input: CreatePartnerComplaintInput,
): Promise<void> {
  const { error } = await createClient().rpc("partner_create_complaint", {
    p_building_id: input.buildingId,
    p_unit_id: input.unitId,
    p_category_id: input.categoryId,
    p_content: input.content,
    p_status: input.status,
    p_completed_at: input.completedAt,
    p_result_content: input.resultContent,
    p_reporter_phone: input.reporterPhone,
  });
  if (error) throw new Error(error.message);
}
