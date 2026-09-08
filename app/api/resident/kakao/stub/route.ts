import { NextResponse } from "next/server";
import { mintResidentSession } from "@/lib/resident/session";

type StubBody = {
  kakaoId?: string;
  name?: string;
  phone?: string;
  profileImage?: string;
};

export async function POST(req: Request) {
  // Local-development stub. It remains blocked in production unless explicitly enabled.
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
    || (body.profileImage !== undefined && typeof body.profileImage !== "string")
  ) {
    return NextResponse.json({ error: "Stub identity fields must be strings." }, { status: 422 });
  }

  const kakaoId = body.kakaoId?.trim()
    || `stub_${crypto.randomUUID().replaceAll("-", "")}`;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(kakaoId)) {
    return NextResponse.json({ error: "Invalid Kakao stub id." }, { status: 422 });
  }

  try {
    const session = await mintResidentSession({
      kakaoId,
      name: body.name?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      profileImage: body.profileImage,
    });
    const response = NextResponse.json({
      userId: session.userId,
      kakaoId: session.kakaoId,
      name: session.name,
      phone: session.phone,
      profileImage: session.profileImage,
    });
    session.applyTo(response);
    return response;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unable to establish the resident session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
