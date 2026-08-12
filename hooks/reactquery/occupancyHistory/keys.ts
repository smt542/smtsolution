export const occupancyHistoryKeys = { all: ["occupancyHistory"] as const, byUnit: (id: number) => ["occupancyHistory", id] as const };
