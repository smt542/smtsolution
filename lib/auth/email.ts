const DEFAULT_DOMAIN = "staff.gwanribiseo.app";

export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (!u) throw new Error("username is required");
  const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || DEFAULT_DOMAIN;
  return `${u}@${domain}`;
}
