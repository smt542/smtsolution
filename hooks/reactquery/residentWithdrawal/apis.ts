import { createClient } from "@/lib/supabase/client";

// Resident self-service withdrawal: releases the caller's own household link and
// Kakao identity via the resident_withdraw RPC (0063). Returns nothing on success.
export async function residentWithdraw(): Promise<void> {
  const { error } = await createClient().rpc("resident_withdraw");
  if (error) throw new Error(error.message);
}
