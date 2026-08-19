export const residentProfileKeys = {
  all: ["residentProfile"] as const,
  profile: () => ["residentProfile", "profile"] as const,
};
