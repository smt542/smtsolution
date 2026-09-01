// hooks/reactquery/buildingCustomerNumbers/keys.ts
import type { CustomerNumberFilters } from "./apis";

export const customerNumberKeys = {
  all: ["buildingCustomerNumbers"] as const,
  byBuilding: (id: number) => ["buildingCustomerNumbers", id] as const,
  meterDays: (ids: number[]) => ["buildingCustomerNumbers", "meterDays", ids] as const,
  lookup: (filters: CustomerNumberFilters) => ["building-customer-numbers", "lookup", filters] as const,
};
