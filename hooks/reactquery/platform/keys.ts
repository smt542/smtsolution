import type {
  PlatformHqAccountQuery,
  PlatformOrganizationQuery,
  PointTransactionQuery,
} from "./apis";
import type { PointReservationQuery } from "./pointBilling";

export const platformKeys = {
  all: ["platform-admin"] as const,
  overview: () => [...platformKeys.all, "overview"] as const,
  organizationContractKpis: () => [...platformKeys.all, "organization-contract-kpis"] as const,
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
  hqAccounts: (opts?: PlatformHqAccountQuery) => opts
    ? [
        ...platformKeys.all,
        "hq-accounts",
        opts.search?.trim() ?? "",
        opts.page ?? 1,
        opts.pageSize ?? 10,
      ] as const
    : [...platformKeys.all, "hq-accounts"] as const,
  canManageHqAccounts: () => [...platformKeys.all, "can-manage-hq-accounts"] as const,
  settings: () => [...platformKeys.all, "settings"] as const,
  billing: (month: string) => [...platformKeys.all, "billing", month] as const,
  monthlySendCost: (year: number) =>
    [...platformKeys.all, "monthly-send-cost", year] as const,
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
  organizationOwner: (orgId: number) => [...platformKeys.all, "organization-owner", orgId] as const,
  organizationContractFile: (path: string) =>
    [...platformKeys.all, "organization-contract-file", path, "preview"] as const,
};
