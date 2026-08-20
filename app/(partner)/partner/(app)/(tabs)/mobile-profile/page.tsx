import { createClient } from "@/lib/supabase/server";

import { ProfileView } from "./ProfileView";

export const dynamic = "force-dynamic";

export default async function PartnerProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_get_profile");
  const p = (Array.isArray(data) ? data[0] : data) ?? null;
  return (
    <ProfileView
      fullName={p?.full_name ?? ""}
      username={p?.username ?? ""}
      phone={p?.phone ?? ""}
    />
  );
}
