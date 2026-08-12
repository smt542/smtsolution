export const leaseKeys = { all: ["leaseContracts"] as const, byOccupancy: (id: number) => ["leaseContracts", id] as const };
