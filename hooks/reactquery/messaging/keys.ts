export const messagingKeys = {
  all: ["messaging"] as const,
  logs: (limit?: number) => ["messaging", "logs", limit] as const,
  consent: (buildingId: number) => ["messaging", "consent", buildingId] as const,
  pointQuote: (input: unknown) => ["messaging", "point-quote", input] as const,
};
