import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Stores the raw user-entered PIN without making storage failures affect the request. */
export async function storeAccountLoginPin(
  admin: AdminClient,
  userId: string,
  pin: string,
  source: string,
): Promise<void> {
  try {
    const { error } = await admin.rpc("store_account_login_pin", {
      p_user_id: userId,
      p_pin: pin,
    });
    if (error) console.error(`${source} store_account_login_pin failed`, error.message);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`${source} store_account_login_pin failed`, message);
  }
}
