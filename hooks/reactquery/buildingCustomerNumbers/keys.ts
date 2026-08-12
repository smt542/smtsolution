// hooks/reactquery/buildingCustomerNumbers/keys.ts
export const customerNumberKeys = {
  all: ["buildingCustomerNumbers"] as const,
  byBuilding: (id: number) => ["buildingCustomerNumbers", id] as const,
};
