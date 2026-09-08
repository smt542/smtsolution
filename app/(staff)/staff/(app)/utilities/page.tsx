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
  return <GasUtilitiesWorkspace />;
}
