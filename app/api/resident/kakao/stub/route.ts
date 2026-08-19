import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type StubBody = {
  kakaoId?: string;
  name?: string;
  phone?: string;
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

export async function POST(req: Request) {
  // Stub-only: mints a resident session without real auth. Blocked in production unless
  // explicitly enabled. Replace with real Kakao OAuth before any production rollout.
  if (process.env.NODE_ENV === "production" && process.env.RESIDENT_STUB_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = await req.json().catch(() => ({}));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 422 });
  }

  const body = parsed as StubBody;
  if (
    (body.kakaoId !== undefined && typeof body.kakaoId !== "string")
    || (body.name !== undefined && typeof body.name !== "string")
    || (body.phone !== undefined && typeof body.phone !== "string")
  ) {
    return NextResponse.json({ error: "Stub identity fields must be strings." }, { status: 422 });
  }

  const kakaoId = body.kakaoId?.trim()
    || `stub_${crypto.randomUUID().replaceAll("-", "")}`;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(kakaoId)) {
    return NextResponse.json({ error: "Invalid Kakao stub id." }, { status: 422 });
  }

  const email = `kakao_${kakaoId}@resident.stub`.toLowerCase();
  const password = `${crypto.randomUUID()}Aa1!`;
  const admin = createAdminClient();

  const { data: existingIdentity, error: identityLookupError } = await admin
    .from("resident_identities")
    .select("user_id,kakao_name,phone")
    .eq("kakao_id", kakaoId)
    .maybeSingle();
  if (identityLookupError) {
    return NextResponse.json({ error: "Unable to read the stub identity." }, { status: 500 });
  }

  const name = body.name?.trim() || existingIdentity?.kakao_name || "Stub Resident";
  const phone = body.phone?.trim() || existingIdentity?.phone || mockPhone();

  let user: User | null = null;
  let created = false;

  if (existingIdentity?.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(existingIdentity.user_id);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unable to find the stub auth user." }, { status: 500 });
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
        return NextResponse.json({ error: "Unable to search stub auth users." }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Unable to create the stub auth user." }, { status: 500 });
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unable to find the stub auth user." }, { status: 500 });
  }

  if (!created) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: "Unable to prepare the stub auth user." }, { status: 500 });
    }
  }

  const { error: upsertError } = await admin.from("resident_identities").upsert({
    user_id: user.id,
    kakao_id: kakaoId,
    kakao_name: name,
    phone,
  }, { onConflict: "user_id" });
  if (upsertError) {
    return NextResponse.json({ error: "Unable to save the stub identity." }, { status: 500 });
  }

  const sessionClient = await createClient();
  const { data: sessionData, error: sessionError } = await sessionClient.auth.signInWithPassword({
    email,
    password,
  });
  if (sessionError || !sessionData.session) {
    return NextResponse.json({ error: "Unable to establish the resident session." }, { status: 500 });
  }

  return NextResponse.json({ userId: user.id, kakaoId, name, phone });
}
