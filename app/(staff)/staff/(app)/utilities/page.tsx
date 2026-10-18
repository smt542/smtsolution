import { redirect } from "next/navigation";
import ElectricityUtilitiesWorkspace from "./ElectricityUtilitiesWorkspace";
import GasUtilitiesWorkspace from "./GasUtilitiesWorkspace";
import { WaterUtilitiesScreen } from "./WaterUtilitiesScreen";

export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const utilityType = (await searchParams).type;

  if (utilityType === "electricity") {
    return <ElectricityUtilitiesWorkspace />;
  }
  if (utilityType === "water") {
    return <WaterUtilitiesScreen initialType="water" />;
  }
  if (utilityType === "gas") {
    return <GasUtilitiesWorkspace />;
  }
  // type 없이(공과금 관리 메뉴·예전 주소) 들어오면 기본 화면인 가스로 보내 주소와 화면을 맞춘다.
  redirect("/staff/utilities?type=gas");
}
