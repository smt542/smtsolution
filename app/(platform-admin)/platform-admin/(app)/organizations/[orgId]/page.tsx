"use client";
import { useParams } from "next/navigation";
import { OrgBuildingsList } from "./components/OrgBuildingsList";

export default function PlatformOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  return <OrgBuildingsList orgId={Number(orgId)} />;
}
