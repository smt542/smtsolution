"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useResidentMyLink } from "@/hooks/reactquery/residentClaims";
import { createClient } from "@/lib/supabase/client";

type AuthState = "loading" | "authenticated" | "anonymous" | "error";

export function useResidentGuard() {
  const router = useRouter();
  const linkQuery = useResidentMyLink();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authAttempt, setAuthAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (cancelled) return;

        if (error) {
          setAuthState("error");
          return;
        }

        if (!data.user) {
          setAuthState("anonymous");
          router.replace("/resident/login");
          return;
        }

        setAuthState("authenticated");
      } catch {
        if (cancelled) return;
        setAuthState("error");
      }
    };

    void checkUser();
    return () => {
      cancelled = true;
    };
  }, [authAttempt, router]);

  useEffect(() => {
    if (
      authState === "authenticated" &&
      !linkQuery.isPending &&
      !linkQuery.error &&
      !linkQuery.data
    ) {
      router.replace("/resident/verify");
    }
  }, [authState, linkQuery.data, linkQuery.error, linkQuery.isPending, router]);

  const error =
    authState === "error"
      ? new Error("로그인 정보를 확인하지 못했습니다.")
      : authState === "authenticated"
        ? linkQuery.error
        : null;

  return {
    loading:
      authState === "loading" ||
      (authState === "authenticated" && linkQuery.isPending),
    link: authState === "authenticated" ? (linkQuery.data ?? null) : null,
    error,
    retry: () => {
      setAuthState("loading");
      setAuthAttempt((attempt) => attempt + 1);
      return linkQuery.refetch();
    },
  };
}
