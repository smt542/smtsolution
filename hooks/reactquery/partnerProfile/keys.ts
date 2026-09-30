export const partnerProfileKeys = {
  all: ["partnerProfile"] as const,
  myPin: () => ["partnerProfile", "myPin"] as const,
};
