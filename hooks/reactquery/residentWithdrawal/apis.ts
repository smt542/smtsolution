// Resident self-service withdrawal (회원 탈퇴): hard-deletes the caller's account.
// Posts to the service-role route (app/api/resident/withdraw), which verifies the
// session, writes the RESIDENT_WITHDRAW audit entry via resident_withdraw (0063),
// then removes the auth.users record (auth.identities + cascade children + sessions).
// L5. Returns nothing on success; throws the server error message on failure.
export async function residentWithdraw(): Promise<void> {
  const response = await fetch("/api/resident/withdraw", { method: "POST" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload && typeof payload.error === "string"
      ? payload.error
      : "회원 탈퇴에 실패했습니다.";
    throw new Error(message);
  }
}
