import type { CookieOptions, SetAllCookies } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import { normalizePhone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ResidentSessionInput = {
  kakaoId: string;
  name: string | null | undefined;
  phone: string | null | undefined;
  profileImage?: string | null;
};

type SessionCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export type ResidentSessionResult = {
  userId: string;
  kakaoId: string;
  name: string | null;
  phone: string | null;
  profileImage: string | null;
  applyTo(response: NextResponse): void;
};

function mockPhone() {
  return `010${Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0")}`;
}

function isDuplicateUserError(error: { code?: string; message?: string } | null) {
  return error?.code === "email_exists"
    || /already|exists|registered/i.test(error?.message ?? "");
}

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<User | null> {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.nextPage === null) return null;
    page = data.nextPage;
  }
}

function normalizeNullablePhone(phone: string | null): string | null {
  if (phone === null) return null;
  return normalizePhone(phone) || null;
}

export async function mintResidentSession(
  input: ResidentSessionInput,
): Promise<ResidentSessionResult> {
  const kakaoId = input.kakaoId.trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(kakaoId)) {
    throw new Error("Invalid Kakao id.");
  }

  const email = `kakao_${kakaoId}@resident.stub`.toLowerCase();
  const password = `${crypto.randomUUID()}Aa1!`;
  const admin = createAdminClient();

  const { data: existingIdentity, error: identityLookupError } = await admin
    .from("resident_identities")
    .select("user_id,kakao_name,phone,profile_image_url")
    .eq("kakao_id", kakaoId)
    .maybeSingle();
  if (identityLookupError) {
    throw new Error("Unable to read the resident identity.");
  }

  const name = input.name === undefined
    ? existingIdentity?.kakao_name || "Stub Resident"
    : input.name?.trim() || null;
  const phoneSource = input.phone === undefined
    ? existingIdentity?.phone || mockPhone()
    : input.phone;
  const phone = normalizeNullablePhone(phoneSource);
  const profileImage = input.profileImage === undefined
    ? existingIdentity?.profile_image_url ?? null
    : input.profileImage?.trim() || null;

  let user: User | null = null;
  let created = false;

  if (existingIdentity?.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(existingIdentity.user_id);
    if (error || !data.user) {
      throw new Error("Unable to find the resident auth user.");
    }
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (data.user) {
      user = data.user;
      created = true;
    } else if (isDuplicateUserError(error)) {
      try {
        user = await findUserByEmail(admin, email);
      } catch {
        throw new Error("Unable to search resident auth users.");
      }
    } else {
      throw new Error("Unable to create the resident auth user.");
    }
  }

  if (!user) {
    throw new Error("Unable to find the resident auth user.");
  }

  if (!created) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error("Unable to prepare the resident auth user.");
    }
  }

  const { error: upsertError } = await admin.from("resident_identities").upsert({
    user_id: user.id,
    kakao_id: kakaoId,
    kakao_name: name,
    phone,
    profile_image_url: profileImage,
  }, { onConflict: "user_id" });
  if (upsertError) {
    throw new Error("Unable to save the resident identity.");
  }

  const sessionCookies: SessionCookie[] = [];
  const sessionHeaders = new Headers();
  const collectSessionCookies: SetAllCookies = (cookiesToSet, headers) => {
    sessionCookies.push(...cookiesToSet);
    Object.entries(headers).forEach(([key, value]) => sessionHeaders.set(key, value));
  };
  const sessionClient = await createClient(collectSessionCookies);
  const { data: sessionData, error: sessionError } = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (sessionError || !sessionData.session) {
    throw new Error("Unable to establish the resident session.");
  }

  return {
    userId: user.id,
    kakaoId,
    name,
    phone,
    profileImage,
    applyTo(response) {
      sessionCookies.forEach(({ name: cookieName, value, options }) => {
        response.cookies.set(cookieName, value, options);
      });
      sessionHeaders.forEach((value, key) => response.headers.set(key, value));
    },
  };
}
