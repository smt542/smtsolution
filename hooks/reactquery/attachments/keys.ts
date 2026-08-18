// hooks/reactquery/attachments/keys.ts
export const attachmentKeys = {
  all: ["attachments"] as const,
  byEntity: (entityType: string, entityId: number) => ["attachments", entityType, entityId] as const,
  byEntities: (entityType: string, entityIds: number[]) =>
    ["attachments", entityType, "many", [...entityIds].sort((a, b) => a - b)] as const,
};
