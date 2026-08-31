export const entryAlertKeys = {
  all: ["entryAlerts"] as const,
  todayMoveIns: (today: string) =>
    [...entryAlertKeys.all, "move-ins", today] as const,
  leaseExpiries: (today: string, withinDays: number) =>
    [...entryAlertKeys.all, "lease-expiries", today, withinDays] as const,
};
