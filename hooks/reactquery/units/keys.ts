export const unitKeys = {
  all: ["units"] as const,
  one: (id: number) => ["units", id] as const,
};
