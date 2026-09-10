import { UtilityWorkspaceHeader } from "../UtilityWorkspaceHeader";

interface GasWorkspaceHeaderProps {
  onOpenLedger: () => void;
  onOpenCarryOver: () => void;
}

export function GasWorkspaceHeader({
  onOpenLedger,
  onOpenCarryOver,
}: GasWorkspaceHeaderProps) {
  return (
    <UtilityWorkspaceHeader
      utilityLabel="가스"
      onOpenLedger={onOpenLedger}
      onOpenCarryOver={onOpenCarryOver}
    />
  );
}
