import { auth } from "@clerk/nextjs/server";
import { getSupabase } from "../../../lib/supabase";
import { canAccessStandard } from "../../../lib/auth";

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

  if (!(await canAccessStandard(userId, standardCode))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data } = await getSupabase()
      .from("progress")
      .select("status")
      .eq("user_id", userId)
      .eq("standard_code", standardCode)
      .maybeSingle();

    return Response.json({ status: data?.status ?? null });
  } catch (error) {
    console.error("Progress fetch failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { standardCode, action, answered, total, answers } = body;

  if (typeof standardCode !== "string" || !["viewed", "completed"].includes(action)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!(await canAccessStandard(userId, standardCode))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (answered !== undefined || total !== undefined) {
    const isNonNegInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;
    if (!isNonNegInt(answered) || !isNonNegInt(total) || answered > total) {
      return Response.json({ error: "Invalid answered/total" }, { status: 400 });
    }
  }

  if (answers !== undefined) {
    const isValidAnswers =
      answers &&
      typeof answers === "object" &&
      Array.isArray(answers.checklist) &&
      answers.checklist.every((v: unknown) => typeof v === "boolean") &&
      Array.isArray(answers.scenarios) &&
      answers.scenarios.every(
        (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0),
      );
    if (!isValidAnswers) {
      return Response.json({ error: "Invalid answers" }, { status: 400 });
    }
  }

  try {
    const now = new Date().toISOString();
    const cols =
      action === "viewed"
        ? { status: "viewed", viewed_at: now }
        : { status: "completed", completed_at: now };

    await getSupabase()
      .from("progress")
      .upsert({ user_id: userId, standard_code: standardCode, ...cols }, { onConflict: "user_id,standard_code" });

    if (action === "completed" && answers !== undefined) {
      await getSupabase()
        .from("module_answers")
        .upsert({ user_id: userId, standard_code: standardCode, answers }, { onConflict: "user_id,standard_code" });
    }

    const event: Record<string, unknown> = {
      user_id: userId,
      event_type: `module_${action}`,
      standard_code: standardCode,
    };
    if (answered !== undefined) {
      event.metadata = { answered, total };
    }

    await getSupabase().from("activity_events").insert(event);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Progress update failed:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}