import { buildingClasses as styles } from "./buildingClasses";
import { Spinner } from "@/components/common";

export default function PartnerBuildingLoading() {
  return (
    <div className={styles.root}>
      <Spinner label="건물 화면 불러오는 중" showLabel className="min-h-[240px]" />
    </div>
  );
}
