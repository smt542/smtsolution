"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { createClient } from "@/lib/supabase/client";

/** 비활성(is_active=false) 계정은 즉시 로그아웃 + 로그인으로. */
export function AccountActiveGuard() {
  const { data: me } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me && me.isActive === false) {
      void createClient().auth.signOut().finally(() => router.replace("/staff/login"));
    }
  }, [me, router]);
  return null;
}
