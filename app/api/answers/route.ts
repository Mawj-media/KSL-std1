import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const standardCode = new URL(req.url).searchParams.get("standardCode");
  if (!standardCode) {
    return Response.json({ error: "Missing standardCode" }, { status: 400 });
  }

  try {
    const { data } = await getSupabase()
      .from("module_answers")
      .select("answers")
      .eq("user_id", userId)
      .eq("standard_code", standardCode)
      .maybeSingle();

    return Response.json({ answers: data?.answers ?? null });
  } catch (error) {
    console.error("Answers fetch failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
