export const overdueKeys = {
  all: ["overdue"] as const,
  buildings: () => ["overdue", "buildings"] as const,
  households: (buildingId: number) => ["overdue", "households", buildingId] as const,
};

