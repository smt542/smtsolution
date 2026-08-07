"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { shouldSignOutOnBoot, AUTO_LOGIN_KEY, SESSION_ALIVE_KEY } from "@/lib/auth/sessionPersistence";

export function AuthBoot() {
  useEffect(() => {
    const autoLogin = localStorage.getItem(AUTO_LOGIN_KEY) === "1";
    const sessionAlive = sessionStorage.getItem(SESSION_ALIVE_KEY) === "1";
    if (shouldSignOutOnBoot(autoLogin, sessionAlive)) {
      createClient().auth.signOut();
    }
    sessionStorage.setItem(SESSION_ALIVE_KEY, "1");
  }, []);
  return null;
}
