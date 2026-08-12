// hooks/reactquery/attachments/keys.ts
export const attachmentKeys = {
  all: ["attachments"] as const,
  byEntity: (entityType: string, entityId: number) => ["attachments", entityType, entityId] as const,
};
