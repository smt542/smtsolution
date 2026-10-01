export const accountKeys = {
  all: ["accounts"] as const,
  list: (search?: string, type?: string) => ["accounts", "list", search ?? "", type ?? ""] as const,
  loginPins: () => ["accounts", "loginPins"] as const,
};
