export const tenantOutputKeys = {
  cardRows: (buildingId: number) => ["tenantOutput", "card-rows", buildingId] as const,
};
