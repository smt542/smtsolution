export const vendorKeys = {
  all: ["vendors"] as const,
  list: (categoryId?: number, search?: string) => ["vendors", "list", categoryId ?? null, search ?? ""] as const,
  attachments: (vendorId: number) => ["vendors", "attachments", vendorId] as const,
};
