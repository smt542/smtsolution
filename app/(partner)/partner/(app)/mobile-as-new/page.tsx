import { createClient } from "@/lib/supabase/server";

import PartnerAsNewWorkspace, {
  type Building,
  type Cat,
} from "./PartnerAsNewWorkspace";

export const dynamic = "force-dynamic";

function koreaTodayLabel(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}.${values.month}.${values.day}`;
}

export default async function PartnerAsNewPage() {
  const supabase = await createClient();
  const [{ data: buildingData }, { data: categoryData }, { data: profileData }] =
    await Promise.all([
      supabase.rpc("partner_list_buildings"),
      supabase.rpc("partner_list_as_categories"),
      supabase.rpc("partner_get_profile"),
    ]);

  const profile = Array.isArray(profileData) ? profileData[0] : profileData;

  return (
    <PartnerAsNewWorkspace
      buildings={(Array.isArray(buildingData) ? buildingData : []) as Building[]}
      cats={(Array.isArray(categoryData) ? categoryData : []) as Cat[]}
      myName={profile?.full_name ?? ""}
      today={koreaTodayLabel()}
    />
  );
}
