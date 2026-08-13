export const messagingKeys = {
  all: ["messaging"] as const,
  logs: (limit?: number) => ["messaging", "logs", limit] as const,
};
