export const dashboardKeys = {
  all: ["dashboard"] as const,
  overview: (today: string) => [...dashboardKeys.all, "overview", today] as const,
};
