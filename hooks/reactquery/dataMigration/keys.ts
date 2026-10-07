export const dataMigrationKeys = {
  all: ["dataMigration"] as const,
  runs: () => ["dataMigration", "runs"] as const,
};
