export const platformKeys = {
  all: ["platform-admin"] as const,
  overview: () => [...platformKeys.all, "overview"] as const,
  organizations: () => [...platformKeys.all, "organizations"] as const,
  accounts: () => [...platformKeys.all, "accounts"] as const,
  transactions: (opts?: { type?: "charge" | "usage" }) =>
    [...platformKeys.all, "transactions", opts?.type ?? "all"] as const,
};
