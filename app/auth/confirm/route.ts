import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const db = await serverClient();
  if (
    db &&
    token_hash &&
    (type === "signup" || type === "recovery" || type === "email")
  ) {
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        new URL(type === "recovery" ? "/auth?recovery=1" : "/", request.url),
      );
  }
  return NextResponse.redirect(
    new URL("/auth?error=confirmation", request.url),
  );
}
