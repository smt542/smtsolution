import type {
  PlatformAccountQuery,
  PlatformOrganizationQuery,
  PointTransactionQuery,
} from "./apis";
import type { PointReservationQuery } from "./pointBilling";

export const platformKeys = {
  all: ["platform-admin"] as const,
  overview: () => [...platformKeys.all, "overview"] as const,
  organizations: (opts?: PlatformOrganizationQuery) => opts
    ? [
        ...platformKeys.all,
        "organizations",
        opts.includeDeleted ?? false,
        opts.status ?? "all",
        opts.search?.trim() ?? "",
        opts.page ?? 1,
        opts.pageSize ?? 25,
      ] as const
    : [...platformKeys.all, "organizations"] as const,
  accounts: (opts?: PlatformAccountQuery) => opts
    ? [
        ...platformKeys.all,
        "accounts",
        opts.search?.trim() ?? "",
        opts.page ?? 1,
        opts.pageSize ?? 25,
      ] as const
    : [...platformKeys.all, "accounts"] as const,
  settings: () => [...platformKeys.all, "settings"] as const,
  billing: (month: string) => [...platformKeys.all, "billing", month] as const,
  overviewMetrics: (month: string) =>
    [...platformKeys.all, "overview-metrics", month] as const,
  transactions: (opts?: Omit<PointTransactionQuery, "cursor">) =>
    [
      ...platformKeys.all,
      "transactions",
      opts?.type ?? "all",
      opts?.pageSize ?? 50,
    ] as const,
  messagePointRates: (includeHistory = false) =>
    [...platformKeys.all, "message-point-rates", includeHistory] as const,
  pointReservations: (opts?: PointReservationQuery) =>
    [
      ...platformKeys.all,
      "point-reservations",
      opts?.statuses?.join(",") ?? "all",
      opts?.page ?? 1,
      opts?.pageSize ?? 25,
    ] as const,
  orgBuildings: (orgId: number) => [...platformKeys.all, "org-buildings", orgId] as const,
  buildingTenants: (buildingId: number) => [...platformKeys.all, "building-tenants", buildingId] as const,
  unit: (unitId: number) => [...platformKeys.all, "unit", unitId] as const,
};
