import { createClient } from "@/lib/supabase/client";
import { HIDDEN_CATEGORY_LABELS } from "@/lib/vendors/vendorRoles";

export interface VendorCategory { id: number; orgId: number; label: string; sortOrder: number; isDefault: boolean; }

type VendorCategoryRow = { id: number; org_id: number; label: string; sort_order: number; is_default: boolean };

const rowToCategory = (r: VendorCategoryRow): VendorCategory => ({ id: r.id, orgId: r.org_id, label: r.label, sortOrder: r.sort_order, isDefault: r.is_default });

export async function listVendorCategories(): Promise<VendorCategory[]> {
  const { data, error } = await createClient().from("vendor_categories").select("*").order("sort_order").order("id");
  if (error) throw new Error(error.message);
  // 유선방송정보업체는 고정 8종에서 제외(연결 업체가 있어 DB에 남은 경우도 숨김).
  return (data ?? []).filter((r) => !HIDDEN_CATEGORY_LABELS.includes(r.label.replace(/\s+/g, ""))).map(rowToCategory);
}
